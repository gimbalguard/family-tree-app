'use client';
import React, { useState } from 'react';
import ReactFlow, {
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodeDragStart,
  type OnNodeDragStop,
  type OnEdgeDoubleClick,
  BackgroundVariant,
  type OnPaneClick,
  type OnEdgeClick,
  type OnNodeDoubleClick,
  type OnNodeContextMenu,
  type IsValidConnection,
  ConnectionMode,
  type OnSelectionChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PersonNode } from './person-node';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Moved to module level to prevent re-creation on every render.
const nodeTypes: NodeTypes = { personNode: PersonNode };

type FamilyTreeCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeDoubleClick?: OnNodeDoubleClick;
  onEdgeDoubleClick?: OnEdgeDoubleClick;
  onPaneClick?: OnPaneClick;
  onNodeDragStart: OnNodeDragStart;
  onNodeDrag: OnNodeDrag;
  onNodeDragStop: OnNodeDragStop;
  onNodeContextMenu: OnNodeContextMenu;
  isValidConnection: IsValidConnection;
  onSelectionChange: OnSelectionChange;
};

export function FamilyTreeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onPaneClick,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodeContextMenu,
  isValidConnection,
  onSelectionChange,
}: FamilyTreeCanvasProps) {
  const [isMinimapVisible, setIsMinimapVisible] = useState(false);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        className="bg-background"
        panOnDrag={true}
        zoomOnScroll={true}
        selectionKeyCode="Control"
        multiSelectionKeyCode="Control"
        onSelectionChange={onSelectionChange}
        minZoom={0.05}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls />
        {isMinimapVisible && <MiniMap nodeStrokeWidth={3} zoomable pannable />}
      </ReactFlow>
      <div className="absolute bottom-4 right-4 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsMinimapVisible((v) => !v)}
              className="shadow-lg"
            >
              <Map className="h-5 w-5" />
              <span className="sr-only">Toggle Minimap</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>הצג/הסתר מפה מוקטנת</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
