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
const COLUMN_WIDTH = 280;
const NODE_HEIGHT = 90;
const MIN_VERTICAL_GAP = 8;
const NORMAL_VERTICAL_GAP = 40;

const nodeTypes = { timelinePerson: TimelinePersonNode };
const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];


const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();
  const personMap = new Map(people.map((p) => [p.id, p]));
  const childrenMap = new Map<string, string[]>();

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      if (!childrenMap.has(rel.personAId)) {
        childrenMap.set(rel.personAId, []);
      }
      childrenMap.get(rel.personAId)!.push(rel.personBId);
    }
  }

  const allChildrenIds = new Set(
    relationships
      .filter((r) => PARENT_REL_TYPES.includes(r.relationshipType))
      .map((r) => r.personBId)
  );
    
  const roots = people.filter((p) => !allChildrenIds.has(p.id));

  const queue: { personId: string; gen: number }[] = [];

  roots.forEach((root) => {
    if (!generations.has(root.id)) {
      generations.set(root.id, 1);
      queue.push({ personId: root.id, gen: 1 });
    }
  });
  
  let head = 0;
  while(head < queue.length) {
    const { personId, gen } = queue[head++];
    const children = childrenMap.get(personId) || [];
    for (const childId of children) {
      if (!generations.has(childId)) {
        generations.set(childId, gen + 1);
        queue.push({ personId: childId, gen: gen + 1 });
      }
    }
  }

  // Handle any disconnected subgraphs or cycles
  for (const person of people) {
    if (!generations.has(person.id)) {
      generations.set(person.id, 1);
    }
  }

  return generations;
};


function TimelineViewContent({
  people,
  relationships,
  edgeType,
  isCompact,
}: {
    people: Person[],
    relationships: Relationship[],
    edgeType: EdgeType,
    isCompact: boolean
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
    const datedPeople = people.map((p) => ({
        ...p,
        birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null,
      })).filter((p) => p.birthYear !== null && !isNaN(p.birthYear as number));

    const minYear =
      datedPeople.length > 0
        ? Math.min(...datedPeople.map(p => p.birthYear!)) - 5
        : new Date().getFullYear() - 50;
    
    const maxYear =
      datedPeople.length > 0
        ? Math.max( ...datedPeople.map((p) => p.deathDate ? new Date(p.deathDate).getFullYear() : p.birthYear!), new Date().getFullYear()) + 5
        : new Date().getFullYear();

    setYearRange({ min: minYear, max: maxYear });

    const generations = assignGenerations(people, relationships);
    const peopleByGeneration = new Map<number, Person[]>();

    for (const person of people) {
        const gen = generations.get(person.id) || 1;
        if (!peopleByGeneration.has(gen)) {
            peopleByGeneration.set(gen, []);
        }
        peopleByGeneration.get(gen)!.push(person);
    }

    peopleByGeneration.forEach((group) => {
        group.sort((a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'));
    });

    const newNodes: Node[] = [];
    const sortedGenerationKeys = Array.from(peopleByGeneration.keys()).sort((a,b) => a-b);
    
    // 2. Position nodes based on mode (Compact vs Normal)
    if (isCompact) {
      // ── COMPACT MODE ───────────────────────────────────────────────
      // Stack cards tightly within each column, ignore Y axis for positioning.
      for(const gen of sortedGenerationKeys) {
        const peopleInGen = peopleByGeneration.get(gen) || [];
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        let currentY = 0;

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
      // ── NORMAL (EXPANDED) MODE ───────────────────────────────────
      // Align to Y axis, handle overlaps within columns.
      const columnBottomY = new Map<number, number>();

      for(const gen of sortedGenerationKeys) {
        const peopleInGen = peopleByGeneration.get(gen) || [];
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;

        for (const person of peopleInGen) {
          const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;

          // Default position for people without a birth year (at the bottom of their gen)
          let idealY = (columnBottomY.get(gen) || (maxYear - minYear) * PIXELS_PER_YEAR) + NORMAL_VERTICAL_GAP;
          if (birthYear) {
            idealY = (birthYear - minYear) * PIXELS_PER_YEAR;
          }
          
          const prevBottom = columnBottomY.get(gen) ?? -Infinity;
          const yPos = Math.max(idealY, prevBottom + NORMAL_VERTICAL_GAP);
          
          newNodes.push({
            id: person.id,
            type: 'timelinePerson',
            position: { x: xPos, y: yPos },
            data: person,
          });

          columnBottomY.set(gen, yPos + NODE_HEIGHT);
        }
      }
    }
    setNodes(newNodes);

    // 3. Create Edges
    const newEdges: Edge[] = relationships.map((rel) => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
    }));
    setEdges(newEdges);

    setTimeout(
      () => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }),
      100
    );
  }, [people, relationships, setViewport, edgeType, isCompact]);

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
    people: Person[],
    relationships: Relationship[],
    edgeType: EdgeType,
    isCompact: boolean
}) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
