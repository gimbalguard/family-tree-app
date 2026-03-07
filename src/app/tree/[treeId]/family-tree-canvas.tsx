'use client';
import React, { useState, useEffect } from 'react';
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
  type OnNodeDragStop,
  type OnEdgeDoubleClick,
  BackgroundVariant,
  type OnPaneClick,
  type OnEdgeClick,
  type OnNodeDoubleClick,
  type IsValidConnection,
  ConnectionMode,
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
  onNodeDoubleClick,
  onEdgeClick,
  onEdgeDoubleClick,
  onPaneClick,
  onNodeDragStop,
  isValidConnection,
}: FamilyTreeCanvasProps) {
  const [isMinimapVisible, setIsMinimapVisible] = useState(false);
  const { setMultiSelectionKey } = useReactFlow();

  useEffect(() => {
    setMultiSelectionKey('Shift');
    // Set it back to null on unmount to be clean
    return () => {
      setMultiSelectionKey(null);
    };
  }, [setMultiSelectionKey]);
  
  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        fitView
        className="bg-background"
        nodesDraggable={true} // Ensure nodes are always draggable
        panOnDrag={true}
        zoomOnScroll={true}
        selectNodesOnDrag={false}
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
