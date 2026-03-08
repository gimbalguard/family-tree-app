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
const COLUMN_WIDTH = 300; // Increased spacing between columns
const NODE_HEIGHT = 76; // Height of the TimelinePersonNode
const MIN_VERTICAL_GAP = 8;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];

// This function needs to be absolutely correct.
const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string[]>();

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      // personA is parent, personB is child
      if (!childrenMap.has(rel.personAId)) childrenMap.set(rel.personAId, []);
      childrenMap.get(rel.personAId)!.push(rel.personBId);

      if (!parentMap.has(rel.personBId)) parentMap.set(rel.personBId, []);
      parentMap.get(rel.personBId)!.push(rel.personAId);
    }
  }

  // Roots are people who are not children in any parental relationship.
  const roots = people.filter(p => !parentMap.has(p.id));

  // BFS from the roots to assign generations
  const queue: { personId: string; gen: number }[] = [];
  const visited = new Set<string>();

  roots.forEach(root => {
    if (!visited.has(root.id)) {
      queue.push({ personId: root.id, gen: 1 });
      visited.add(root.id);
    }
  });

  let head = 0;
  while (head < queue.length) {
    const { personId, gen } = queue[head++];
    generations.set(personId, gen);

    const children = childrenMap.get(personId) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ personId: childId, gen: gen + 1 });
        visited.add(childId);
      }
    }
  }
  
  // Handle any disconnected graphs or cycles by assigning them generation 1
  people.forEach(p => {
    if (!generations.has(p.id)) {
      generations.set(p.id, 1);
    }
  });

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
    const datedPeople = people.map(p => ({
        ...p,
        birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null,
      })).filter(p => p.birthYear !== null && !isNaN(p.birthYear));

    const minYear =
      datedPeople.length > 0
        ? Math.min(...datedPeople.map(p => p.birthYear!)) - 5
        : new Date().getFullYear() - 50;
    
    const maxYear =
      datedPeople.length > 0
        ? Math.max( ...datedPeople.map(p => (p.deathDate ? new Date(p.deathDate).getFullYear() : p.birthYear!)), new Date().getFullYear()) + 5
        : new Date().getFullYear();

    setYearRange({ min: minYear, max: maxYear });

    const generations = assignGenerations(people, relationships);
    const peopleByGeneration = new Map<number, Person[]>();

    for (const person of people) {
        const gen = generations.get(person.id) || 1;
        if (!peopleByGeneration.has(gen)) peopleByGeneration.set(gen, []);
        peopleByGeneration.get(gen)!.push(person);
    }

    const newNodes: Node<Person>[] = [];
    const sortedGenerationKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);
    
    // 2. Position nodes based on mode (Compact vs Normal)
    for(const gen of sortedGenerationKeys) {
        const peopleInGen = peopleByGeneration.get(gen) || [];
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        
        // Always sort by birthdate within a generation
        const sortedPeopleInGen = [...peopleInGen].sort((a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'));

        if (isCompact) {
            // COMPACT MODE: Stack vertically, ignoring year axis for positioning.
            let currentY = 0;
            for (const person of sortedPeopleInGen) {
                newNodes.push({
                    id: person.id,
                    type: 'timelinePerson',
                    position: { x: xPos, y: currentY },
                    data: person,
                });
                currentY += NODE_HEIGHT + MIN_VERTICAL_GAP;
            }
        } else {
            // NORMAL MODE: Align to Y axis based on birth year.
            const tempNodesInGen: Node<Person>[] = [];
            for (const person of sortedPeopleInGen) {
                 const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
                 // Position primarily by birth year. If no birth year, place it at the start of the timeline for visibility.
                 const yPos = birthYear ? (birthYear - minYear) * PIXELS_PER_YEAR : 0;
                 tempNodesInGen.push({
                    id: person.id,
                    type: 'timelinePerson',
                    position: { x: xPos, y: yPos },
                    data: person,
                });
            }

            // After initial placement, resolve overlaps within this column
            for (let i = 1; i < tempNodesInGen.length; i++) {
                const prevNode = tempNodesInGen[i-1];
                const currentNode = tempNodesInGen[i];
                
                const requiredY = prevNode.position.y + NODE_HEIGHT + MIN_VERTICAL_GAP;
                if (currentNode.position.y < requiredY) {
                    currentNode.position.y = requiredY;
                }
            }
            newNodes.push(...tempNodesInGen);
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

    // Don't auto-fit view, let user explore
    if (nodes.length === 0) { // Only fit view on initial load
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }

  }, [people, relationships, setViewport, edgeType, isCompact, nodes.length]);

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
