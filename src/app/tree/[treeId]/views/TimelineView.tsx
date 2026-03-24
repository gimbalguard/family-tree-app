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
import { cn } from '@/lib/utils';


const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 120;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;

// Compact layout constants
const NODE_WIDTH = 160;
const ROW_HEIGHT = 240;
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 40;
const FAMILY_GROUP_GAP = 80;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Generation Assignment ────────────────────────────────────────────────────
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  rootId?: string
): Map<string, number> => {
  const generations = new Map<string, number>();
  const parentMap = new Map<string, string[]>();
  people.forEach(p => parentMap.set(p.id, []));
  relationships.forEach(rel => {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      parentMap.get(rel.personBId)?.push(rel.personAId);
    }
  });

  const getGeneration = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 1; // Cycle detected, break it.
    if (generations.has(personId)) return generations.get(personId)!;
    
    visited.add(personId);
    const parents = parentMap.get(personId) || [];
    if (parents.length === 0) {
      generations.set(personId, 1);
      return 1;
    }
    const parentGens = parents.map(pId => getGeneration(pId, new Set(visited)));
    const maxParentGen = Math.max(...parentGens);
    const newGen = maxParentGen + 1;
    generations.set(personId, newGen);
    return newGen;
  };

  // Start with all people to ensure everyone is processed
  people.forEach(p => {
    if (!generations.has(p.id)) {
      getGeneration(p.id);
    }
  });

  return generations;
};


// ─── Edge handle logic ────────────────────────────────────────────────────────
const getEdgeProps = (
  rel: Relationship,
  nodes: Node<Person>[]
) => {
  const nodeA = nodes.find((n) => n.id === rel.personAId);
  const nodeB = nodes.find((n) => n.id === rel.personBId);

  if (!nodeA || !nodeB) {
      return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
  }

  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      return {
          source: rel.personAId,
          target: rel.personBId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
      };
  }

  const aIsLeft = nodeA.position.x <= nodeB.position.x;
  return {
      source: rel.personAId,
      target: rel.personBId,
      sourceHandle: aIsLeft ? 'right' : 'left',
      targetHandle: aIsLeft ? 'left' : 'right',
  };
};

// ─── Tree Layout ──────────────────────────────────────────────────────────────
const buildTreeLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType,
  ownerId?: string
): {
  nodes: Node<Person>[];
  edges: Edge[];
  axisInfo: { gen: number; y: number; yearRange: string }[];
} => {
  const personMap = new Map(people.map(p => [p.id, p]));
  const parentMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();
  const partnersMap = new Map<string, string>();

  people.forEach(p => {
    parentMap.set(p.id, []);
    childrenMap.set(p.id, []);
  });

  relationships.forEach(rel => {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childrenMap.get(rel.personAId)?.push(rel.personBId);
      parentMap.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnersMap.set(rel.personAId, rel.personBId);
      partnersMap.set(rel.personBId, rel.personAId);
    }
  });

  const byGen = new Map<number, Person[]>();
  people.forEach(p => {
    const gen = generations.get(p.id);
    if (gen) {
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push(p);
    }
  });

  const xPositions = new Map<string, number>();
  let currentX = 0;

  const getPersonWidth = (id: string) => {
    const partnerId = partnersMap.get(id);
    if (partnerId) {
      const rel = relationships.find(r => (r.personAId === id && r.personBId === partnerId) || (r.personBId === id && r.personAId === partnerId));
      if (rel && SEPARATED_REL_TYPES.includes(rel.relationshipType)) return NODE_WIDTH + SEPARATED_GAP;
      return NODE_WIDTH + SPOUSE_GAP;
    }
    return NODE_WIDTH;
  };

  const roots = people.filter(p => (parentMap.get(p.id) || []).length === 0);
  const processed = new Set<string>();

  const placeNode = (id: string, x: number) => {
    if (processed.has(id)) return;
    xPositions.set(id, x);
    processed.add(id);
  };
  
  const genKeys = Array.from(byGen.keys()).sort((a,b)=>a-b);
  genKeys.forEach(gen => {
    const genPeople = byGen.get(gen)!;
    let localX = 0;
    
    // Group by families
    const families: string[][] = [];
    const inFamily = new Set<string>();
    
    genPeople.forEach(p => {
        if(inFamily.has(p.id)) return;
        const family = [p.id];
        inFamily.add(p.id);
        const partner = partnersMap.get(p.id);
        if(partner && genPeople.some(gp => gp.id === partner)) {
            family.push(partner);
            inFamily.add(partner);
        }
        families.push(family);
    });
    
    families.forEach(family => {
        const parentNode = family.length > 1 ? people.find(p => p.id === family[0] || p.id === family[1]) : people.find(p => p.id === family[0]);
        const children = childrenMap.get(parentNode!.id) || [];
        const childXs = children.map(cid => xPositions.get(cid)).filter(x => x !== undefined) as number[];
        
        let targetX = localX;
        if(childXs.length > 0) {
            const minX = Math.min(...childXs);
            const maxX = Math.max(...childXs);
            targetX = minX + (maxX - minX) / 2;
        }

        if(family.length > 1) {
            const p1 = family[0];
            const p2 = family[1];
            const p1X = targetX - (NODE_WIDTH + SPOUSE_GAP) / 2;
            const p2X = p1X + NODE_WIDTH + SPOUSE_GAP;
            placeNode(p1, p1X);
            placeNode(p2, p2X);
            localX = p2X + NODE_WIDTH + FAMILY_GROUP_GAP;
        } else {
            placeNode(family[0], targetX);
            localX = targetX + NODE_WIDTH + FAMILY_GROUP_GAP;
        }
    });
  });
  
  const nodes: Node<Person>[] = people.map(p => {
    const gen = generations.get(p.id) ?? 1;
    return {
      id: p.id,
      type: 'timelinePerson',
      position: { x: xPositions.get(p.id) || 0, y: (gen - 1) * ROW_HEIGHT },
      data: p
    };
  });

  const edges: Edge[] = relationships.map(rel => {
    const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, nodes);
    return {
      id: rel.id,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: edgeType,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      animated: false,
    };
  });
  
  const axisInfo: { gen: number; y: number; yearRange: string }[] = [];
  for (const [gen, genPeople] of Array.from(byGen.entries()).sort(([a], [b]) => a - b)) {
    const birthYears = genPeople
      .map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null)
      .filter((y): y is number => y !== null);
    const minYear = birthYears.length > 0 ? Math.min(...birthYears) : null;
    const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : null;
    const yearRange = minYear && maxYear
      ? (minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`)
      : '';
    axisInfo.push({ gen, y: (gen - 1) * ROW_HEIGHT, yearRange });
  }

  return { nodes, edges, axisInfo };
};


// ─── Generation Axis ──────────────────────────────────────────────────────────
const GenerationAxis = memo(({
  axisInfo,
  rowHeight,
}: {
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


// ─── Main Component ───────────────────────────────────────────────────────────
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
      const generations = assignGenerations(people, relationships, tree?.ownerPersonId);
      const { nodes: newNodes, edges: newEdges, axisInfo: newAxisInfo } =
        buildTreeLayout(people, relationships, generations, edgeType, tree?.ownerPersonId);
      setNodes(newNodes);
      setEdges(newEdges);
      setAxisInfo(newAxisInfo);

      // Center on owner if set, otherwise fit entire tree
      setTimeout(() => {
        if (tree?.ownerPersonId && !hasCenteredOnOwner.current) {
          hasCenteredOnOwner.current = true;
          fitView({
            nodes: [{ id: tree.ownerPersonId }],
            duration: 600,
            padding: 0.5,
          });
        } else {
          fitView({ padding: 0.15, duration: 500 });
        }
      }, 150);
      return;
    }

    // Reset centering flag when switching modes
    hasCenteredOnOwner.current = false;

    // Default timeline mode — unchanged
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
        const idealY = person.birthYear !== null
          ? (person.birthYear - minYear) * PIXELS_PER_YEAR
          : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
        const lastY = lastOccupiedYinColumn.get(gen)!;
        const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
        newNodes.push({ id: person.id, type: 'timelinePerson', position: { x: xPos, y: yPos }, data: person });
        lastOccupiedYinColumn.set(gen, yPos);
      }
    }

    setNodes(newNodes);
    setEdges(relationships.map(rel => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    })));

    if (nodes.length === 0 && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, setViewport, nodes.length, fitView, tree?.ownerPersonId, centerOnOwner]);

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
