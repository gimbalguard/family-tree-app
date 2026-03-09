
'use client';
import React, { useState, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  OnNodeDoubleClick,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TimelinePersonNode } from './TimelinePersonNode';
import { TimelineAxis } from './TimelineAxis';
import type { Person, Relationship } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { getYear, isValid, parseISO } from 'date-fns';

// Constants for layout
const PIXELS_PER_YEAR = 80;
const COLUMN_WIDTH = 300;
const NODE_HEIGHT = 76;
const MIN_VERTICAL_GAP = 16;
const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];

// Moved to module level to prevent re-creation on every render. This is critical for performance and stability.
const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

/**
 * A robust function to assign a generation number to each person.
 * It correctly identifies all root nodes (people without parents in the tree)
 * and then assigns generation numbers downwards. Includes cycle detection.
 */
const assignGenerations = (people: Person[], relationships: Relationship[]): Map<string, number> => {
    const generations = new Map<string, number>();
    if (people.length === 0) return new Map();

    const childrenMap = new Map<string, string[]>();
    relationships.forEach(rel => {
        if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationshipType)) {
            if (!childrenMap.has(rel.personAId)) childrenMap.set(rel.personAId, []);
            childrenMap.get(rel.personAId)!.push(rel.personBId);
        }
    });

    const parentMap = new Map<string, string[]>();
    for (const person of people) {
        parentMap.set(person.id, []);
    }

    for (const rel of relationships) {
        if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
            const currentParents = parentMap.get(rel.personBId) || [];
            parentMap.set(rel.personBId, [...currentParents, rel.personAId]);
        }
    }

    const memo = new Map<string, number>();

    function findGeneration(personId: string, path: Set<string> = new Set()): number {
        if (path.has(personId)) {
          // Cycle detected, treat as a root to prevent infinite loop
          return 1;
        }
        if (memo.has(personId)) return memo.get(personId)!;

        const parents = parentMap.get(personId) || [];
        if (parents.length === 0) {
            memo.set(personId, 1);
            return 1;
        }

        path.add(personId);
        const parentGenerations = parents.map(pId => findGeneration(pId, new Set(path)));
        path.delete(personId);

        const generation = Math.max(...parentGenerations) + 1;
        memo.set(personId, generation);
        return generation;
    }

    for (const person of people) {
        if (!memo.has(person.id)) {
            findGeneration(person.id);
        }
    }
    
    // Fallback for any unassigned (should not happen with cycle detection)
    for (const person of people) {
      if (!memo.has(person.id)) {
        memo.set(person.id, 0);
      }
    }

    return memo;
};

function TimelineViewContent({
  people,
  relationships,
  edgeType,
  isCompact,
  onNodeDoubleClick,
}: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const { setViewport } = useReactFlow();

  useEffect(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const generations = assignGenerations(people, relationships);
    const peopleWithData = people.map(p => {
        const date = p.birthDate ? parseISO(p.birthDate) : null;
        return {
            ...p,
            birthYear: date && isValid(date) ? getYear(date) : null,
            generation: generations.get(p.id) || 0,
        };
    }).filter(p => p.generation > 0);

    const validBirthYears = peopleWithData.map(p => p.birthYear).filter((y): y is number => y !== null);
    const minYear = validBirthYears.length > 0 ? Math.min(...validBirthYears) - 5 : new Date().getFullYear() - 50;
    const maxYear = validBirthYears.length > 0 ? Math.max(...validBirthYears, new Date().getFullYear()) + 5 : new Date().getFullYear();
    setYearRange({ min: minYear, max: maxYear });

    const peopleByGeneration = new Map<number, typeof peopleWithData>();
    for (const person of peopleWithData) {
      if (!peopleByGeneration.has(person.generation)) peopleByGeneration.set(person.generation, []);
      peopleByGeneration.get(person.generation)!.push(person);
    }
    
    const newNodes: Node<Person>[] = [];
    const sortedGenerationKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);
    
    if (isCompact) {
      // Shrunk / Compact View: Stack cards vertically in each column
      for (const gen of sortedGenerationKeys) {
        if (gen === 0) continue;
        const peopleInGen = (peopleByGeneration.get(gen) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        let currentY = 0; // Start each column at y=0

        for (const person of peopleInGen) {
          newNodes.push({
            id: person.id,
            type: 'timelinePerson',
            position: { x: xPos, y: currentY },
            data: person,
          });
          currentY += NODE_HEIGHT + MIN_VERTICAL_GAP;
        }
      }
    } else {
      // Normal View: Align to year axis with overlap avoidance
      const lastOccupiedYinColumn = new Map<number, number>();
      for (const gen of sortedGenerationKeys) {
        if (gen === 0) continue;
        const peopleInGen = (peopleByGeneration.get(gen) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        lastOccupiedYinColumn.set(gen, -Infinity);

        for (const person of peopleInGen) {
          // If birth year is unknown, stack them at the top.
          const idealY = person.birthYear !== null 
            ? (person.birthYear - minYear) * PIXELS_PER_YEAR 
            : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
          
          const lastY = lastOccupiedYinColumn.get(gen)!;
          // Only push down if it overlaps, otherwise use ideal position
          const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
          
          newNodes.push({
            id: person.id,
            type: 'timelinePerson',
            position: { x: xPos, y: yPos },
            data: person,
          });
          lastOccupiedYinColumn.set(gen, yPos);
        }
      }
    }
    
    setNodes(newNodes);

    const newEdges: Edge[] = relationships.map(rel => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
    }));
    setEdges(newEdges);

    if (nodes.length === 0 && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, setViewport, nodes.length]);

  return (
    <div className="h-full w-full relative bg-background">
      <TimelineAxis
        minYear={yearRange.min}
        maxYear={yearRange.max}
        pixelsPerYear={PIXELS_PER_YEAR}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView={false}
        className="ml-20"
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={4}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>
    </div>
  );
}

export function TimelineView(props: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick;
}) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
