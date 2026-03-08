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
const COLUMN_WIDTH = 250; // card width + gap
const VERTICAL_GAP = 40;
const NODE_HEIGHT = 70; // Approximate height of TimelinePersonNode

const nodeTypes = { timelinePerson: TimelinePersonNode };

type TimelineViewProps = {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
};

function TimelineViewContent({
  people,
  relationships,
  edgeType,
  isCompact,
}: TimelineViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const { setViewport } = useReactFlow();

  useEffect(() => {
    // 1. Separate people with and without birthdates
    const datedPeople = people
      .map((p) => ({
        ...p,
        birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null,
      }))
      .filter((p) => p.birthYear !== null && !isNaN(p.birthYear))
      .sort((a, b) => a.birthYear! - b.birthYear!);

    const undatedPeople = people.filter(
      (p) => !p.birthDate || isNaN(new Date(p.birthDate).getFullYear())
    );

    if (datedPeople.length === 0 && undatedPeople.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const minYear =
      datedPeople.length > 0
        ? datedPeople[0].birthYear!
        : new Date().getFullYear() - 50;
    const maxYear =
      datedPeople.length > 0
        ? Math.max(...datedPeople.map(p => p.deathDate ? new Date(p.deathDate).getFullYear() : p.birthYear!), new Date().getFullYear())
        : new Date().getFullYear();
    setYearRange({ min: minYear, max: maxYear });

    const newNodes: Node[] = [];
    const MAX_COLUMNS = 5;

    if (isCompact) {
      // --- COMPACT LAYOUT LOGIC ---
      const columns: number[] = Array(MAX_COLUMNS).fill(0);
      datedPeople.forEach((person) => {
        let targetColumnIndex = 0;
        let minYEnd = columns[0];
        for (let i = 1; i < columns.length; i++) {
          if (columns[i] < minYEnd) {
            minYEnd = columns[i];
            targetColumnIndex = i;
          }
        }
        
        const yPos = (minYEnd === 0 ? 0 : minYEnd + VERTICAL_GAP);
        
        newNodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: 100 + targetColumnIndex * COLUMN_WIDTH, y: yPos },
          data: person,
        });
        
        columns[targetColumnIndex] = yPos + NODE_HEIGHT;
      });

    } else {
      // --- ORIGINAL LAYOUT LOGIC ---
      const columns: number[] = []; // Stores the y-end of the last node in each column
      datedPeople.forEach((person) => {
        const yPos = (person.birthYear! - minYear) * PIXELS_PER_YEAR;
        let placed = false;

        for (let i = 0; i < columns.length; i++) {
          if (yPos > columns[i] + VERTICAL_GAP) {
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
    }

    // Layout undated people (same logic for both modes)
    let lastY = Math.max(0, ...newNodes.map((n) => n.position.y + NODE_HEIGHT));
    lastY = isFinite(lastY) ? lastY + VERTICAL_GAP * 3 : 100;

    if (undatedPeople.length > 0) {
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
          color: 'hsl(var(--muted-foreground))',
        },
      });

      undatedPeople.forEach((person, index) => {
        newNodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: {
            x: 100 + (index % 4) * COLUMN_WIDTH,
            y: lastY + Math.floor(index / 4) * (NODE_HEIGHT + VERTICAL_GAP),
          },
          data: person,
        });
      });
    }

    setNodes(newNodes);

    // Create edges
    const newEdges: Edge[] = relationships.map((rel) => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: true,
    }));
    setEdges(newEdges);

    // Set initial view
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

export function TimelineView(props: TimelineViewProps) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
