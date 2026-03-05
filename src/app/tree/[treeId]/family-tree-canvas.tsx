'use client';
import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type OnNodeDragStop,
  type OnNodeClick,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PersonNode } from './person-node';
import type { Person } from '@/lib/types';
import { Toolbar } from './toolbar';

type FamilyTreeCanvasProps = {
  treeName: string;
  nodes: Node[];
  edges: Edge[];
  setNodes: (fn: (nodes: Node[]) => Node[]) => void;
  setEdges: (fn: (edges: Edge[]) => Edge[]) => void;
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: OnNodeClick;
  onNodeDragStop: OnNodeDragStop;
  onCreatePerson: (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => void;
};

export function FamilyTreeCanvas({
  treeName,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDragStop,
  onCreatePerson,
}: FamilyTreeCanvasProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({ personNode: PersonNode }), []);
  const treeId = nodes[0]?.data.treeId;

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        {treeId && (
          <Toolbar treeName={treeName} treeId={treeId} onCreatePerson={onCreatePerson} />
        )}
      </ReactFlow>
    </div>
  );
}
