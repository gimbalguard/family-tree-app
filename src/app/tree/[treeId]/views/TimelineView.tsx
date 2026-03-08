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
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TimelinePersonNode } from './TimelinePersonNode';
import { TimelineAxis } from './TimelineAxis';
import type { Person, Relationship } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';

// Constants for layout
const PIXELS_PER_YEAR = 80;
const COLUMN_WIDTH = 300;
const NODE_HEIGHT = 76;
const MIN_VERTICAL_GAP = 16;
const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];

const nodeTypes = { timelinePerson: TimelinePersonNode };

/**
 * A robust function to assign a generation number to each person.
 * It correctly identifies all root nodes (people without parents in the tree)
 * and then assigns generation numbers downwards.
 */
const assignGenerations = (people: Person[], relationships: Relationship[]): Map<string, number> => {
  const generations = new Map<string, number>();
  const parentMap = new Map<string, string[]>();
  const personIds = new Set(people.map(p => p.id));

  // Initialize parent map for all people
  for (const person of people) {
    parentMap.set(person.id, []);
  }

  // Populate parent map from relationships
  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType) && personIds.has(rel.personAId) && personIds.has(rel.personBId)) {
      // personA is parent, personB is child
      parentMap.get(rel.personBId)!.push(rel.personAId);
    }
  }

  // Memoization cache for the recursive function
  const memo = new Map<string, number>();

  function findGeneration(personId: string): number {
    if (memo.has(personId)) {
      return memo.get(personId)!;
    }

    const parents = parentMap.get(personId) || [];
    // A person with no parents in the tree is Generation 1.
    if (parents.length === 0) {
      memo.set(personId, 1);
      return 1;
    }

    // A person's generation is 1 + the max generation of their parents.
    const parentGenerations = parents.map(pId => findGeneration(pId));
    const generation = Math.max(...parentGenerations) + 1;
    memo.set(personId, generation);
    return generation;
  }

  // Calculate generation for every person.
  for (const person of people) {
    findGeneration(person.id);
  }
  
  return memo;
};


function TimelineViewContent({
  people,
  relationships,
  edgeType,
  isCompact,
}: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
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

    // 1. Determine Year Range & Generations
    const datedPeople = people.map(p => ({
        ...p,
        birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null,
      })).filter(p => p.birthYear !== null && !isNaN(p.birthYear));

    const minYear = datedPeople.length > 0 ? Math.min(...datedPeople.map(p => p.birthYear!)) - 5 : new Date().getFullYear() - 50;
    const maxYear = datedPeople.length > 0 ? Math.max(...datedPeople.map(p => p.deathDate ? new Date(p.deathDate).getFullYear() : p.birthYear!), new Date().getFullYear()) + 5 : new Date().getFullYear();

    setYearRange({ min: minYear, max: maxYear });

    const generations = assignGenerations(people, relationships);
    const peopleByGeneration = new Map<number, Person[]>();

    for (const person of people) {
      const gen = generations.get(person.id) || 1;
      if (!peopleByGeneration.has(gen)) peopleByGeneration.set(gen, []);
      peopleByGeneration.get(gen)!.push(person);
    }
    
    // 2. Create Nodes with correct positioning
    const newNodes: Node<Person>[] = [];
    const sortedGenerationKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);

    for (const gen of sortedGenerationKeys) {
      const peopleInGen = peopleByGeneration.get(gen) || [];
      const xPos = 100 + (gen - 1) * COLUMN_WIDTH;

      const sortedPeopleInGen = [...peopleInGen].sort((a, b) =>
        (a.birthDate || '9999').localeCompare(b.birthDate || '9999')
      );
      
      let lastYInColumn = -Infinity;

      for (const person of sortedPeopleInGen) {
        let yPos;

        if (isCompact) {
          // COMPACT MODE: Stack vertically, ignore year axis.
          yPos = lastYInColumn === -Infinity ? 0 : lastYInColumn + NODE_HEIGHT + MIN_VERTICAL_GAP;
        } else {
          // NORMAL MODE: Align to Y axis, then resolve overlaps.
          const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
          // Start with the exact year position. If no birth year, stack it after the last one.
          const initialYPos = birthYear ? (birthYear - minYear) * PIXELS_PER_YEAR : (lastYInColumn === -Infinity ? 0 : lastYInColumn + NODE_HEIGHT + MIN_VERTICAL_GAP);
          
          // Check for overlap with the previously placed node IN THE SAME COLUMN
          if (lastYInColumn !== -Infinity && initialYPos < lastYInColumn + NODE_HEIGHT + MIN_VERTICAL_GAP) {
            // Push down to avoid overlap
            yPos = lastYInColumn + NODE_HEIGHT + MIN_VERTICAL_GAP;
          } else {
            yPos = initialYPos;
          }
        }

        lastYInColumn = yPos;
        
        newNodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: xPos, y: yPos },
          data: person,
        });
      }
    }
    setNodes(newNodes);

    // 3. Create Edges
    const newEdges: Edge[] = relationships.map(rel => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
    }));
    setEdges(newEdges);

    // Only fit view on initial load
    if (nodes.length === 0 && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, edgeType, isCompact]);

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
}) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
