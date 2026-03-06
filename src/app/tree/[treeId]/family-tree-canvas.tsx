'use client';
import React from 'react';
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
  type OnEdgeDoubleClick,
  BackgroundVariant,
  type OnPaneClick,
  type OnEdgeClick,
  type OnNodeDoubleClick,
  type IsValidConnection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PersonNode } from './person-node';

const nodeTypes: NodeTypes = { personNode: PersonNode };

type FamilyTreeCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick?: OnNodeClick;
  onNodeDoubleClick?: OnNodeDoubleClick;
  onEdgeClick?: OnEdgeClick;
  onEdgeDoubleClick?: OnEdgeDoubleClick;
  onPaneClick?: OnPaneClick;
  onNodeDragStop: OnNodeDragStop;
  isValidConnection: IsValidConnection;
};

export function FamilyTreeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onEdgeDoubleClick,
  onPaneClick,
  onNodeDragStop,
  isValidConnection,
}: FamilyTreeCanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        fitView
        className="bg-background"
        nodesDraggable={true} // Ensure nodes are always draggable
        panOnDrag={true}
        zoomOnScroll={true}
        selectNodesOnDrag={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}
