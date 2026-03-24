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

import { PersonNode } from '../person-node';
import type { Person, Relationship } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { Button } from '@/components/ui/button';
import { Maximize } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getYear, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const nodeTypes: NodeTypes = { personNode: PersonNode };

const g = new dagre.graphlib.Graph();
g.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], rankdir: 'TB' | 'LR' = 'TB') => {
  g.setGraph({ rankdir, ranksep: 40, nodesep: 20 });

  nodes.forEach((node) => g.setNode(node.id, { width: 200, height: 80 }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  nodes.forEach((node) => {
    const nodeWithPosition = g.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 200 / 2,
      y: nodeWithPosition.y - 80 / 2,
    };
    return node;
  });

  return { nodes, edges };
};

const assignGenerations = (people: Person[], relationships: Relationship[]): Map<string, number> => {
    const generations = new Map<string, number>();
    const parentMap = new Map<string, string[]>();
    for (const person of people) {
        parentMap.set(person.id, []);
    }
    for (const rel of relationships) {
        if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationshipType)) {
            const currentParents = parentMap.get(rel.personBId) || [];
            parentMap.set(rel.personBId, [...currentParents, rel.personAId]);
        }
    }
    
    function findGeneration(personId: string, path = new Set<string>()): number {
        if (path.has(personId)) return 1;
        if (generations.has(personId)) return generations.get(personId)!;

        const parents = parentMap.get(personId) || [];
        if (parents.length === 0) {
            generations.set(personId, 1);
            return 1;
        }

        path.add(personId);
        const parentGenerations = parents.map(pId => findGeneration(pId, new Set(path)));
        path.delete(personId);

        const generation = Math.max(...parentGenerations) + 1;
        generations.set(personId, generation);
        return generation;
    }

    for (const person of people) {
        if (!generations.has(person.id)) {
            findGeneration(person.id);
        }
    }
    return generations;
};


function FamilyViewContent({
  people,
  relationships,
  edgeType,
  ownerPersonId,
  onNodeDoubleClick,
}: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  ownerPersonId?: string;
  onNodeDoubleClick?: OnNodeDoubleClick;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const [generationDepth, setGenerationDepth] = useState('all');

  const generations = useMemo(() => assignGenerations(people, relationships), [people, relationships]);

  const { filteredPeople, filteredRelationships } = useMemo(() => {
    const depth = parseInt(generationDepth, 10);
    if (isNaN(depth)) {
        return { filteredPeople: people, filteredRelationships: relationships };
    }

    const ownerGen = ownerPersonId ? generations.get(ownerPersonId) : undefined;
    let visibleGens: Set<number>;

    if (ownerGen !== undefined) {
        visibleGens = new Set([ownerGen]);
        if (depth >= 3) {
            if (ownerGen > 1) visibleGens.add(ownerGen - 1); // Parents
            visibleGens.add(ownerGen + 1); // Children
        }
        if (depth >= 4) {
            if (ownerGen > 2) visibleGens.add(ownerGen - 2); // Grandparents
        }
        if (depth >= 5) {
            visibleGens.add(ownerGen + 2); // Grandchildren
        }
    } else {
      // If no owner, show top N generations from the start
      const sortedGens = [...new Set(generations.values())].sort((a,b) => a-b);
      visibleGens = new Set(sortedGens.slice(0, depth));
    }
    
    const visiblePeople = people.filter(p => visibleGens.has(generations.get(p.id) ?? -1));
    const visiblePeopleIds = new Set(visiblePeople.map(p => p.id));
    const visibleRels = relationships.filter(r => visiblePeopleIds.has(r.personAId) && visiblePeopleIds.has(r.personBId));

    return { filteredPeople: visiblePeople, filteredRelationships: visibleRels };

  }, [people, relationships, generations, ownerPersonId, generationDepth]);


  useEffect(() => {
    const initialNodes: Node<Person>[] = filteredPeople.map((person) => ({
      id: person.id,
      type: 'personNode',
      data: person,
      position: { x: 0, y: 0 },
    }));

    const initialEdges: Edge[] = filteredRelationships.map((rel) => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: ['parent', 'adoptive_parent', 'step_parent', 'guardian'].includes(rel.relationshipType),
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );

    const generationInfo = new Map<number, { yPositions: number[], birthYears: number[] }>();
    layoutedNodes.forEach(node => {
        const person = node.data as Person;
        const gen = generations.get(person.id);
        if (gen) {
            if (!generationInfo.has(gen)) {
                generationInfo.set(gen, { yPositions: [], birthYears: [] });
            }
            generationInfo.get(gen)!.yPositions.push(node.position.y);
            if (person.birthDate) {
                const parsedDate = parseISO(person.birthDate);
                if (isValid(parsedDate)) {
                    generationInfo.get(gen)!.birthYears.push(getYear(parsedDate));
                }
            }
        }
    });

    const labelNodes: Node[] = [];
    generationInfo.forEach((info, gen) => {
        if (info.yPositions.length === 0) return;
        const avgY = info.yPositions.reduce((sum, y) => sum + y, 0) / info.yPositions.length + 40; // 40 is half node height
        const minYear = info.birthYears.length ? Math.min(...info.birthYears) : null;
        const maxYear = info.birthYears.length ? Math.max(...info.birthYears) : null;
        let yearRangeLabel = '';
        if (minYear && maxYear) {
            yearRangeLabel = minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`;
        }

        labelNodes.push({
            id: `gen-label-${gen}`,
            type: 'default',
            position: { x: -160, y: avgY - 15 },
            data: { label: `דור ${gen}` + (yearRangeLabel ? ` (${yearRangeLabel})` : '') },
            draggable: false,
            selectable: false,
            style: {
                background: 'transparent',
                border: 'none',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#64748b',
                width: 140,
                textAlign: 'right',
            },
            className: 'pointer-events-none'
        });
    });

    setNodes([...layoutedNodes, ...labelNodes]);
    setEdges(layoutedEdges);

    window.setTimeout(() => {
      fitView({ duration: 400, padding: 0.1 });
    }, 100);

  }, [filteredPeople, filteredRelationships, edgeType, fitView, setNodes, setEdges, generations]);
  
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.1, duration: 400 });
  }, [fitView]);

  return (
    <div className="h-full w-full relative bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        className="family-view-flow"
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleFitView}>
            <Maximize className="ml-2 h-4 w-4" />
            כל העץ
          </Button>
        <Select value={generationDepth} onValueChange={setGenerationDepth}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="הצג דורות..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="3">3 דורות</SelectItem>
                <SelectItem value="4">4 דורות</SelectItem>
                <SelectItem value="5">5 דורות</SelectItem>
                <SelectItem value="all">כל הדורות</SelectItem>
            </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FamilyView(props: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  ownerPersonId?: string;
  onNodeDoubleClick?: OnNodeDoubleClick;
}) {
  return (
    <ReactFlowProvider>
      <FamilyViewContent {...props} />
    </ReactFlowProvider>
  );
}
