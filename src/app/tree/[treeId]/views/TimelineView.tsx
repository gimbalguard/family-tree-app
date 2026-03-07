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

// Constants for layout
const PIXELS_PER_YEAR = 80;
const COLUMN_WIDTH = 250; // card width + gap
const VERTICAL_GAP = 40;
const NODE_HEIGHT = 70; // Approximate height of TimelinePersonNode

const nodeTypes = { timelinePerson: TimelinePersonNode };

type TimelineViewProps = {
  people: Person[];
  relationships: Relationship[];
};

function TimelineViewContent({ people, relationships }: TimelineViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const { setViewport } = useReactFlow();

  useEffect(() => {
    // 1. Separate people with and without birthdates
    const datedPeople = people
      .map(p => ({ ...p, birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null }))
      .filter(p => p.birthYear !== null && !isNaN(p.birthYear))
      .sort((a, b) => a.birthYear! - b.birthYear!);

    const undatedPeople = people.filter(p => !p.birthDate || isNaN(new Date(p.birthDate).getFullYear()));

    if (datedPeople.length === 0 && undatedPeople.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
    }

    const minYear = datedPeople.length > 0 ? datedPeople[0].birthYear! : new Date().getFullYear() - 50;
    const maxYear = datedPeople.length > 0 ? datedPeople[datedPeople.length - 1].birthYear! : new Date().getFullYear();
    setYearRange({ min: minYear, max: maxYear });

    const newNodes: Node[] = [];
    
    // 2. Layout dated people
    const columns: number[] = []; // Stores the y-end of the last node in each column
    
    datedPeople.forEach(person => {
      const yPos = (person.birthYear! - minYear) * PIXELS_PER_YEAR;
      let placed = false;
      
      for (let i = 0; i < columns.length; i++) {
        if (yPos > columns[i] + VERTICAL_GAP) {
          // Place in this column
          newNodes.push({
            id: person.id,
            type: 'timelinePerson',
            position: { x: 100 + i * COLUMN_WIDTH, y: yPos },
            data: person,
          });
          columns[i] = yPos + NODE_HEIGHT;
          placed = true;
          break;
        }
      }

      if (!placed) {
        // Create a new column
        const newColumnIndex = columns.length;
        newNodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: 100 + newColumnIndex * COLUMN_WIDTH, y: yPos },
          data: person,
        });
        columns.push(yPos + NODE_HEIGHT);
      }
    });

    // 3. Layout undated people
    let lastY;
    if (datedPeople.length > 0) {
        const maxY = Math.max(...newNodes.filter(n => n.position).map(n => n.position.y));
        lastY = maxY + NODE_HEIGHT + (VERTICAL_GAP * 3);
    } else {
        lastY = 100; // If no dated people, start from top
    }

    if(undatedPeople.length > 0) {
        newNodes.push({
            id: 'undated-separator',
            type: 'default',
            position: { x: 100, y: lastY - VERTICAL_GAP },
            data: { label: 'תאריך לידה לא ידוע' },
            draggable: false,
            style: {
                width: 'calc(100vw - 120px)',
                backgroundColor: 'transparent',
                border: 'none',
                borderTop: '1px dashed hsl(var(--border))',
                textAlign: 'center',
                color: 'hsl(var(--muted-foreground))'
            }
        });

        undatedPeople.forEach((person, index) => {
            newNodes.push({
                id: person.id,
                type: 'timelinePerson',
                position: { x: 100 + (index % 4) * COLUMN_WIDTH, y: lastY + Math.floor(index/4) * (NODE_HEIGHT + VERTICAL_GAP) },
                data: person,
            });
        });
    }

    setNodes(newNodes);

    // 4. Create edges
    const newEdges: Edge[] = relationships.map(rel => ({
        id: rel.id,
        source: rel.personAId,
        target: rel.personBId,
        type: 'smoothstep',
        animated: true,
    }));
    setEdges(newEdges);
    
    // Set initial view
    setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);

  }, [people, relationships, setViewport]);

  return (
    <div className="h-full w-full relative bg-background">
      <TimelineAxis minYear={yearRange.min} maxYear={yearRange.max} pixelsPerYear={PIXELS_PER_YEAR} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView={false} // We are setting view manually
        className="ml-20" // Offset for the axis
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


export function TimelineView(props: TimelineViewProps) {
    return (
        <ReactFlowProvider>
            <TimelineViewContent {...props} />
        </ReactFlowProvider>
    );
}
