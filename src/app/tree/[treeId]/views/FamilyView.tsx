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
import { LocateFixed } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const nodeTypes: NodeTypes = { personNode: PersonNode };

const g = new dagre.graphlib.Graph();
g.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], rankdir: 'TB' | 'LR' = 'TB') => {
  g.setGraph({ rankdir, ranksep: 80, nodesep: 40 });

  nodes.forEach((node) => g.setNode(node.id, { width: 256, height: 116 }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  nodes.forEach((node) => {
    const nodeWithPosition = g.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 256 / 2,
      y: nodeWithPosition.y - 116 / 2,
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
      for (let i = 1; i < depth; i++) {
        if (ownerGen - i > 0) visibleGens.add(ownerGen - i);
        if (ownerGen + i <= generations.size) visibleGens.add(ownerGen + i);
      }
    } else {
      // If no owner, show top N generations
      visibleGens = new Set(Array.from({ length: depth }, (_, i) => i + 1));
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

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    window.setTimeout(() => {
      fitView({ duration: 500, padding: 0.1 });
    }, 100);

  }, [filteredPeople, filteredRelationships, edgeType, fitView, setNodes, setEdges]);
  
  const handleCenterOnMe = useCallback(() => {
    if (ownerPersonId) {
      fitView({ nodes: [{ id: ownerPersonId }], duration: 800, maxZoom: 1 });
    }
  }, [ownerPersonId, fitView]);

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
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {ownerPersonId && (
          <Button variant="secondary" size="sm" onClick={handleCenterOnMe}>
            <LocateFixed className="ml-2 h-4 w-4" />
            מרכז אותי
          </Button>
        )}
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
