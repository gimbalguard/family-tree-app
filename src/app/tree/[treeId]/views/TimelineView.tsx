'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';

import { TimelinePersonNode } from './TimelinePersonNode';
import { TimelineAxis } from './TimelineAxis';
import type { Person, Relationship } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { getYear, isValid, parseISO } from 'date-fns';

const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 76;
const MIN_VERTICAL_GAP = 16;
const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const COLUMN_WIDTH = 300;

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

const g = new dagre.graphlib.Graph();
g.setDefaultEdgeLabel(() => ({}));

const getCompactLayoutedElements = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType,
) => {
    g.setGraph({ rankdir: 'TB', ranksep: 40, nodesep: 20 });
    
    people.forEach((node) => g.setNode(node.id, { width: 200, height: 80 }));

    const spouseMap = new Map<string, string>();
    relationships.forEach(rel => {
        if(rel.relationshipType === 'spouse') {
            const [p1, p2] = [rel.personAId, rel.personBId].sort();
            spouseMap.set(p1, p2);
            spouseMap.set(p2, p1);
        }
    });

    relationships.forEach((edge) => {
      // For dagre, we only want hierarchical relationships (parent-child)
      // to determine the layout ranking. Spousal/sibling relationships
      // are rendered but don't influence the vertical positioning.
      if (PARENT_REL_TYPES.includes(edge.relationshipType)) {
        g.setEdge(edge.personAId, edge.personBId);
      }
    });


    dagre.layout(g);

    const nodes: Node<Person>[] = people.map((person) => {
        const nodeWithPosition = g.node(person.id);
        const gen = generations.get(person.id) || 0;
        return {
            id: person.id,
            type: 'timelinePerson',
            position: {
                x: nodeWithPosition.x - 100,
                y: nodeWithPosition.y - 40,
            },
            data: person,
        };
    });

    const generationInfo = new Map<number, { yPositions: number[], birthYears: number[] }>();
    nodes.forEach(node => {
        const person = node.data as Person;
        const gen = generations.get(person.id);
        if (gen) {
            if (!generationInfo.has(gen)) generationInfo.set(gen, { yPositions: [], birthYears: [] });
            generationInfo.get(gen)!.yPositions.push(node.position.y);
            if (person.birthDate && isValid(parseISO(person.birthDate))) {
                generationInfo.get(gen)!.birthYears.push(getYear(parseISO(person.birthDate)));
            }
        }
    });

    const labelNodes: Node[] = [];
    generationInfo.forEach((info, gen) => {
        if (info.yPositions.length === 0 || gen === 0) return;
        const avgY = info.yPositions.reduce((sum, y) => sum + y, 0) / info.yPositions.length;
        const minYear = info.birthYears.length ? Math.min(...info.birthYears) : null;
        const maxYear = info.birthYears.length ? Math.max(...info.birthYears) : null;
        let yearRangeLabel = '';
        if (minYear && maxYear) {
            yearRangeLabel = minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`;
        }
        labelNodes.push({
            id: `gen-label-${gen}`, type: 'default', position: { x: -160, y: avgY - 15 },
            data: { label: `דור ${gen}` + (yearRangeLabel ? ` | ${yearRangeLabel}` : '') },
            draggable: false, selectable: false,
            style: { background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 'bold', color: '#64748b', width: 140, textAlign: 'right' },
            className: 'pointer-events-none'
        });
    });

    const edges: Edge[] = relationships.map(rel => ({
        id: rel.id, source: rel.personAId, target: rel.personBId, type: edgeType,
        animated: PARENT_REL_TYPES.includes(rel.relationshipType),
    }));

    return { nodes: [...nodes, ...labelNodes], edges };
};

const assignGenerations = (people: Person[], relationships: Relationship[]): Map<string, number> => {
    const generations = new Map<string, number>();
    if (people.length === 0) return new Map();

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
        if (path.has(personId)) return 1;
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
        if (!memo.has(person.id)) findGeneration(person.id);
    }
    
    for (const person of people) {
      if (!memo.has(person.id)) memo.set(person.id, 0);
    }
    return memo;
};

function TimelineViewContent({ people, relationships, edgeType, isCompact, onNodeDoubleClick }: { people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick; }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const { setViewport, fitView } = useReactFlow();

  useEffect(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (isCompact) {
        const generations = assignGenerations(people, relationships);
        const { nodes: layoutedNodes, edges: layoutedEdges } = getCompactLayoutedElements(people, relationships, generations, edgeType);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 100);
        return;
    }
    
    // Default (non-compact) logic
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
    
    const lastOccupiedYinColumn = new Map<number, number>();
    for (const gen of sortedGenerationKeys) {
        if (gen === 0) continue;
        const peopleInGen = (peopleByGeneration.get(gen) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        lastOccupiedYinColumn.set(gen, -Infinity);

        for (const person of peopleInGen) {
          const idealY = person.birthYear !== null ? (person.birthYear - minYear) * PIXELS_PER_YEAR : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
          const lastY = lastOccupiedYinColumn.get(gen)!;
          const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
          
          newNodes.push({ id: person.id, type: 'timelinePerson', position: { x: xPos, y: yPos }, data: person });
          lastOccupiedYinColumn.set(gen, yPos);
        }
    }
    
    setNodes(newNodes);
    setEdges(relationships.map(rel => ({ id: rel.id, source: rel.personAId, target: rel.personBId, type: edgeType, animated: PARENT_REL_TYPES.includes(rel.relationshipType) })));

    if (nodes.length === 0 && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, setViewport, nodes.length, fitView]);

  return (
    <div className="h-full w-full relative bg-background">
      {!isCompact && (
        <TimelineAxis minYear={yearRange.min} maxYear={yearRange.max} pixelsPerYear={PIXELS_PER_YEAR} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView={isCompact}
        className={isCompact ? '' : "ml-20"}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>
    </div>
  );
}

export function TimelineView(props: { people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick; }) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
