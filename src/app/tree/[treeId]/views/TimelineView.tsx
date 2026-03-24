'use client';
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  OnNodeDoubleClick,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TimelinePersonNode } from './TimelinePersonNode';
import { TimelineAxis } from './TimelineAxis';
import type { Person, Relationship, FamilyTree } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { getYear, isValid, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, LocateFixed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 120;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;

const NODE_WIDTH = 220;
const ROW_HEIGHT = 220; // Increased to give more vertical space
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 80;
const FAMILY_GROUP_GAP = 100;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();
  const MAX_ITERATIONS = people.length * 2 + 10;
  let iterations = 0;
  let changesMade = true;

  while (changesMade && iterations < MAX_ITERATIONS) {
    changesMade = false;
    iterations++;

    for (const person of people) {
      const currentGen = generations.get(person.id);

      const parentIds = relationships
        .filter(r => PARENT_REL_TYPES.includes(r.relationshipType) && r.personBId === person.id)
        .map(r => r.personAId);
      const parentGens = parentIds
        .map(id => generations.get(id))
        .filter((g): g is number => g !== undefined);

      if (parentGens.length > 0) {
        const newGen = Math.max(...parentGens) + 1;
        if (newGen !== currentGen) {
          generations.set(person.id, newGen);
          changesMade = true;
        }
        continue;
      }

      const partnerIds = relationships
        .filter(r => PARTNER_REL_TYPES.includes(r.relationshipType) &&
          (r.personAId === person.id || r.personBId === person.id))
        .map(r => r.personAId === person.id ? r.personBId : r.personAId);
      const partnerGens = partnerIds
        .map(id => generations.get(id))
        .filter((g): g is number => g !== undefined);

      if (partnerGens.length > 0) {
        const newGen = Math.max(...partnerGens);
        if (newGen !== currentGen) {
          generations.set(person.id, newGen);
          changesMade = true;
        }
        continue;
      }

      const siblingIds = relationships
        .filter(r => SIBLING_REL_TYPES.includes(r.relationshipType) &&
          (r.personAId === person.id || r.personBId === person.id))
        .map(r => r.personAId === person.id ? r.personBId : r.personAId);
      const siblingGens = siblingIds
        .map(id => generations.get(id))
        .filter((g): g is number => g !== undefined);

      if (siblingGens.length > 0) {
        const newGen = Math.max(...siblingGens);
        if (newGen !== currentGen) {
          generations.set(person.id, newGen);
          changesMade = true;
        }
        continue;
      }
    }

    for (const person of people) {
      if (!generations.has(person.id)) {
        generations.set(person.id, 1);
        changesMade = true;
      }
    }
  }

  return generations;
};

const getEdgeProps = (
  rel: Relationship,
  positions: Map<string, { x: number; y: number }>
) => {
  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
    return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
  }

  const posA = positions.get(rel.personAId);
  const posB = positions.get(rel.personBId);
  if (!posA || !posB) return { source: rel.personAId, target: rel.personBId, sourceHandle: 'right', targetHandle: 'left' };

  const aIsLeft = posA.x <= posB.x;
  return { source: rel.personAId, target: rel.personBId, sourceHandle: aIsLeft ? 'right' : 'left', targetHandle: aIsLeft ? 'left' : 'right' };
};

const buildCompactLayout = (
    people: Person[],
    relationships: Relationship[],
    generations: Map<string, number>,
    edgeType: EdgeType,
    ownerId?: string
): { nodes: Node<Person>[], edges: Edge[], axisInfo: { gen: number; y: number; yearRange: string }[] } => {

    const personMap = new Map(people.map(p => [p.id, p]));
    const childrenMap = new Map<string, string[]>();
    people.forEach(p => childrenMap.set(p.id, []));
    relationships.forEach(rel => {
        if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
            childrenMap.get(rel.personAId)?.push(rel.personBId);
        }
    });

    const subtreeWidths = new Map<string, number>();
    const calculateSubtreeWidth = (personId: string, visited = new Set<string>()): number => {
        if (visited.has(personId)) return 0;
        visited.add(personId);
        if (subtreeWidths.has(personId)) return subtreeWidths.get(personId)!;

        const children = childrenMap.get(personId) || [];
        if (children.length === 0) {
            subtreeWidths.set(personId, NODE_WIDTH);
            return NODE_WIDTH;
        }
        const width = children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId, new Set(visited)), 0) + (children.length - 1) * SIBLING_GAP;
        subtreeWidths.set(personId, width);
        return width;
    };
    people.forEach(p => calculateSubtreeWidth(p.id));

    const nodes: Node<Person>[] = [];
    const positions = new Map<string, { x: number, y: number }>();

    const byGen = new Map<number, Person[]>();
    people.forEach(p => {
        const gen = generations.get(p.id) || 1;
        if (!byGen.has(gen)) byGen.set(gen, []);
        byGen.get(gen)!.push(p);
    });

    const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);

    for (const gen of sortedGens) {
        const y = (gen - 1) * ROW_HEIGHT;
        const peopleInGen = byGen.get(gen) || [];
        // Further logic needed for X positioning
    }
    
    // Fallback simple layout for now to get something on screen
    let currentX = 0;
    for (const gen of sortedGens) {
        const y = (gen - 1) * ROW_HEIGHT;
        const peopleInGen = byGen.get(gen) || [];
        currentX = 0;
        for (const person of peopleInGen) {
            positions.set(person.id, { x: currentX, y });
            nodes.push({ id: person.id, type: 'timelinePerson', position: { x: currentX, y }, data: person, draggable: false });
            currentX += NODE_WIDTH + SIBLING_GAP;
        }
    }


    const edges: Edge[] = relationships.map(rel => {
        const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, positions);
        return {
            id: rel.id,
            source, target, sourceHandle, targetHandle, type: 'straight',
            style: { stroke: '#94a3b8', strokeWidth: 2 }
        };
    });

    const axisInfo = sortedGens.map(gen => {
        const genPeople = byGen.get(gen) || [];
        const birthYears = genPeople.map(p => p.birthDate ? getYear(parseISO(p.birthDate)) : null).filter((y): y is number => y !== null);
        const minYear = birthYears.length ? Math.min(...birthYears) : null;
        const maxYear = birthYears.length ? Math.max(...birthYears) : null;
        const yearRange = minYear && maxYear ? (minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`) : '';
        return { gen, y: (gen - 1) * ROW_HEIGHT, yearRange };
    });

    return { nodes, edges, axisInfo };
};


const GenerationAxis = memo(({ axisInfo, rowHeight }: {
  axisInfo: { gen: number; y: number; yearRange: string }[];
  rowHeight: number;
}) => {
  const transform = useStore(s => s.transform);
  const [viewportY, viewportZoom] = [transform[1], transform[2]];

  return (
    <div className="absolute left-0 top-0 h-full w-24 bg-muted/20 z-10 select-none overflow-hidden">
      <div className="relative h-full w-full" style={{ transform: `translateY(${viewportY}px)` }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => {
          const yPos = y * viewportZoom;
          const height = rowHeight * viewportZoom;
          return (
            <div
              key={gen}
              style={{ top: `${yPos}px`, height: `${height}px` }}
              className="absolute right-0 left-0 flex flex-col items-center justify-center pr-1 border-b border-border/20 text-center"
            >
              <span className="text-sm font-bold text-foreground leading-none">דור {gen}</span>
              {yearRange && (
                <span className="text-[10px] text-muted-foreground mt-0.5">{yearRange}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
GenerationAxis.displayName = 'GenerationAxis';

function TimelineViewContent({
  people,
  relationships,
  edgeType,
  isCompact,
  onNodeDoubleClick,
  tree,
  onUpdateTree,
}: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick;
  tree?: FamilyTree | null;
  onUpdateTree?: (details: Partial<FamilyTree>) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const [axisInfo, setAxisInfo] = useState<{ gen: number; y: number; yearRange: string }[]>([]);
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  const { setViewport, fitView, getNode } = useReactFlow();
  const hasCenteredOnOwner = useRef(false);

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    const node = getNode(tree.ownerPersonId);
    if (node) {
      fitView({
        nodes: [{ id: tree.ownerPersonId }],
        duration: 600,
        padding: 0.5,
      });
    }
  }, [tree?.ownerPersonId, getNode, fitView]);

  useEffect(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (isCompact) {
      const generations = assignGenerations(people, relationships);
      const { nodes: newNodes, edges: newEdges, axisInfo: newAxisInfo } =
        buildCompactLayout(people, relationships, generations, edgeType, tree?.ownerPersonId);
      setNodes(newNodes);
      setEdges(newEdges);
      setAxisInfo(newAxisInfo);

      setTimeout(() => {
        if (tree?.ownerPersonId && !hasCenteredOnOwner.current) {
          hasCenteredOnOwner.current = true;
          centerOnOwner();
        } else {
          fitView({ padding: 0.15, duration: 500 });
        }
      }, 150);
      return;
    }

    // Default timeline mode
    hasCenteredOnOwner.current = false;
    const generations = assignGenerations(people, relationships);
    const peopleWithData = people.map(p => ({
        ...p,
        birthYear: p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null,
        generation: generations.get(p.id) || 0,
    })).filter(p => p.generation > 0);

    const validBirthYears = peopleWithData.map(p => p.birthYear).filter((y): y is number => y !== null);
    const minYear = validBirthYears.length > 0 ? Math.min(...validBirthYears) - 5 : new Date().getFullYear() - 50;
    const maxYear = validBirthYears.length > 0 ? Math.max(...validBirthYears, new Date().getFullYear()) + 5 : new Date().getFullYear();
    setYearRange({ min, max: maxYear });

    const peopleByGeneration = new Map<number, typeof peopleWithData>();
    peopleWithData.forEach(p => {
        if (!peopleByGeneration.has(p.generation)) peopleByGeneration.set(p.generation, []);
        peopleByGeneration.get(p.generation)!.push(p);
    });

    const newNodes: Node<Person>[] = [];
    const sortedGenKeys = Array.from(peopleByGeneration.keys()).sort((a,b) => a-b);
    const lastOccupiedYinColumn = new Map<number, number>();

    sortedGenKeys.forEach(gen => {
        if (gen === 0) return;
        const peopleInGen = (peopleByGeneration.get(gen) || []).sort((a,b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
        const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
        lastOccupiedYinColumn.set(gen, -Infinity);

        peopleInGen.forEach(p => {
            const idealY = p.birthYear !== null ? (p.birthYear - minYear) * PIXELS_PER_YEAR : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
            const lastY = lastOccupiedYinColumn.get(gen)!;
            const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
            newNodes.push({id: p.id, type: 'timelinePerson', position: {x: xPos, y: yPos}, data: p});
            lastOccupiedYinColumn.set(gen, yPos);
        });
    });

    setNodes(newNodes);
    setEdges(relationships.map(rel => ({
        id: rel.id, source: rel.personAId, target: rel.personBId, type: edgeType,
        animated: PARENT_REL_TYPES.includes(rel.relationshipType),
        style: { stroke: '#94a3b8', strokeWidth: 2 }
    })));

  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, fitView, tree?.ownerPersonId, centerOnOwner]);

  return (
    <div className="h-full w-full relative bg-background">
      {isCompact ? <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} /> : <TimelineAxis minYear={yearRange.min} maxYear={yearRange.max} pixelsPerYear={PIXELS_PER_YEAR} />}
      
      {isCompact && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-sm">
           <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="מרכז עליי" onClick={centerOnOwner} disabled={!tree?.ownerPersonId}>
                        <LocateFixed className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>מרכז עליי</p></TooltipContent>
            </Tooltip>
          <Popover open={isOwnerPopoverOpen} onOpenChange={setIsOwnerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="מי אתה בעץ?">
                <User className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <h4 className="text-sm font-medium p-2 border-b text-center">מי אתה בעץ?</h4>
              <ScrollArea className="h-72">
                <div className="p-2 space-y-1">
                  {people.map(person => (
                    <Button
                      key={person.id}
                      variant={tree?.ownerPersonId === person.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        onUpdateTree?.({ ownerPersonId: person.id });
                        setIsOwnerPopoverOpen(false);
                        setTimeout(() => centerOnOwner(), 100);
                      }}
                    >
                      {person.firstName} {person.lastName}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView={false}
        className={isCompact ? 'ml-24' : 'ml-20'}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={4}
        nodesDraggable={!isCompact}
        nodesConnectable={false}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>
    </div>
  );
}

export function TimelineView(props: {
  people: Person[];
  relationships: Relationship[];
  edgeType: EdgeType;
  isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick;
  tree?: FamilyTree | null;
  onUpdateTree?: (details: Partial<FamilyTree>) => void;
}) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
