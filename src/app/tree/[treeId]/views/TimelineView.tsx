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
const NODE_HEIGHT = 120; // from TimelinePersonNode
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;
const NODE_WIDTH = 160; // from TimelinePersonNode
const ROW_HEIGHT = 220; // Height per generation in compact mode
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 80;
const FAMILY_GROUP_GAP = 100;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// --- Generation Assignment ---
const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();
  const MAX_ITERATIONS = people.length * 2;
  let iterations = 0;
  let changesMade = true;

  const parentMap = new Map<string, string[]>();
  const partnerMap = new Map<string, string[]>();
  for (const p of people) {
    parentMap.set(p.id, []);
    partnerMap.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      parentMap.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnerMap.get(rel.personAId)?.push(rel.personBId);
      partnerMap.get(rel.personBId)?.push(rel.personAId);
    }
  }

  while (changesMade && iterations < MAX_ITERATIONS) {
    changesMade = false;
    iterations++;

    for (const person of people) {
      const currentGen = generations.get(person.id);
      let newGen: number | undefined = undefined;

      const parentIds = parentMap.get(person.id) || [];
      const parentGens = parentIds.map(id => generations.get(id)).filter((g): g is number => g !== undefined);
      if (parentGens.length > 0) {
        newGen = Math.max(...parentGens) + 1;
      }

      if (newGen === undefined) {
        const partnerIds = partnerMap.get(person.id) || [];
        const partnerGens = partnerIds.map(id => generations.get(id)).filter((g): g is number => g !== undefined);
        if (partnerGens.length > 0) newGen = Math.max(...partnerGens);
      }

      if (newGen === undefined) {
        const parents = parentMap.get(person.id) || [];
        const siblingIds = new Set<string>();
        for (const parentId of parents) {
          relationships.forEach(r => {
            if (r.personAId === parentId && PARENT_REL_TYPES.includes(r.relationshipType) && r.personBId !== person.id) {
              siblingIds.add(r.personBId);
            }
          });
        }
        const siblingGens = Array.from(siblingIds).map(id => generations.get(id)).filter((g): g is number => g !== undefined);
        if (siblingGens.length > 0) newGen = Math.max(...siblingGens);
      }
      
      if (newGen === undefined && currentGen === undefined) {
          newGen = 1;
      }
      
      if (newGen !== undefined && newGen !== currentGen) {
        generations.set(person.id, newGen);
        changesMade = true;
      }
    }
  }
  
  for (const person of people) {
      if (!generations.has(person.id)) generations.set(person.id, 1);
  }

  return generations;
};

// --- Edge handle logic ---
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
      return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
  }

  const aIsLeft = nodeA.position.x <= nodeB.position.x;
  return {
      source: rel.personAId, target: rel.personBId,
      sourceHandle: aIsLeft ? 'right' : 'left',
      targetHandle: aIsLeft ? 'left' : 'right',
  };
};

// --- Tree Layout ---
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
    const partnerMap = new Map<string, string>();

    for (const person of people) {
        parentMap.set(person.id, []);
        childrenMap.set(person.id, []);
    }

    for (const rel of relationships) {
        if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
            childrenMap.get(rel.personAId)?.push(rel.personBId);
            parentMap.get(rel.personBId)?.push(rel.personAId);
        }
        if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
            partnerMap.set(rel.personAId, rel.personBId);
            partnerMap.set(rel.personBId, rel.personAId);
        }
    }

    const subtreeWidths = new Map<string, number>();
    const calculateSubtreeWidth = (personId: string, visited: Set<string> = new Set()): number => {
        if (visited.has(personId)) return 0;
        visited.add(personId);
        if (subtreeWidths.has(personId)) return subtreeWidths.get(personId)!;

        const children = [...new Set(childrenMap.get(personId) || [])];
        let width = 0;
        if (children.length > 0) {
            width = children.map(c => calculateSubtreeWidth(c, new Set(visited))).reduce((a, b) => a + b, 0);
        } else {
            width = NODE_WIDTH + FAMILY_GROUP_GAP;
        }

        const partnerId = partnerMap.get(personId);
        if (partnerId && !visited.has(partnerId)) {
            const partnerChildren = childrenMap.get(partnerId) || [];
            const partnerOnlyChildren = partnerChildren.filter(pc => !children.includes(pc));
            const partnerWidth = partnerOnlyChildren.length > 0
                ? partnerOnlyChildren.map(c => calculateSubtreeWidth(c, new Set(visited))).reduce((a, b) => a + b, 0)
                : NODE_WIDTH + SIBLING_GAP;
            const isSeparated = relationships.some(r => ((r.personAId === personId && r.personBId === partnerId) || (r.personBId === personId && r.personAId === partnerId)) && SEPARATED_REL_TYPES.includes(r.relationshipType));
            width += partnerWidth + (isSeparated ? SEPARATED_GAP : SPOUSE_GAP);
        }

        subtreeWidths.set(personId, width);
        return width;
    };
    
    // Find main roots for splitting
    let mainRoots: Person[] = [];
    if (ownerId) {
        const ownerParents = parentMap.get(ownerId) || [];
        const paternalRoot = ownerParents.map(pId => personMap.get(pId)!).find(p => p?.gender === 'male');
        const maternalRoot = ownerParents.map(pId => personMap.get(pId)!).find(p => p?.gender === 'female');
        if (paternalRoot) mainRoots.push(paternalRoot);
        if (maternalRoot) mainRoots.push(maternalRoot);
    } 
    
    if (mainRoots.length < 2) {
      mainRoots = people.filter(p => (parentMap.get(p.id) || []).length === 0).sort((a,b) => (b.birthDate || '').localeCompare(a.birthDate || ''));
    }

    const allNodesData = people.map(p => ({...p, generation: generations.get(p.id)!}));
    allNodesData.forEach(p => calculateSubtreeWidth(p.id));

    const xPositions = new Map<string, number>();

    const positionFamily = (rootId: string, startX: number): number => {
        const q: {id: string, x: number}[] = [{id: rootId, x: startX}];
        const visited = new Set<string>([rootId]);
        let maxX = startX;

        while (q.length > 0) {
            const {id, x} = q.shift()!;
            xPositions.set(id, x);
            maxX = Math.max(maxX, x);

            const partnerId = partnerMap.get(id);
            if (partnerId && !visited.has(partnerId)) {
                visited.add(partnerId);
                const isSeparated = relationships.some(r => ((r.personAId === id && r.personBId === partnerId) || (r.personBId === id && r.personAId === partnerId)) && SEPARATED_REL_TYPES.includes(r.relationshipType));
                xPositions.set(partnerId, x + NODE_WIDTH + (isSeparated ? SEPARATED_GAP : SPOUSE_GAP));
                maxX = Math.max(maxX, x + NODE_WIDTH + (isSeparated ? SEPARATED_GAP : SPOUSE_GAP));
            }
            
            const allChildren = [...new Set([...(childrenMap.get(id) || []), ...(partnerId ? childrenMap.get(partnerId) || [] : [])])];
            const sortedChildren = allChildren.map(cId => personMap.get(cId)!).filter(Boolean).sort((a,b) => (a.birthDate || '').localeCompare(b.birthDate || ''));

            if (sortedChildren.length > 0) {
                const childrenWidth = sortedChildren.reduce((acc, c) => acc + (subtreeWidths.get(c.id) || 0), 0);
                const parentUnitWidth = NODE_WIDTH + (partnerId ? SPOUSE_GAP + NODE_WIDTH : 0);
                let childStartX = x + parentUnitWidth/2 - childrenWidth/2;

                for (const child of sortedChildren) {
                    if (!visited.has(child.id)) {
                        visited.add(child.id);
                        q.push({ id: child.id, x: childStartX });
                    }
                    childStartX += (subtreeWidths.get(child.id) || 0);
                }
            }
        }
        return maxX + NODE_WIDTH + FAMILY_GROUP_GAP;
    };
    
    let currentX = 0;
    const positionedRoots = new Set<string>();
    mainRoots.slice(0,2).forEach(root => {
        if (!positionedRoots.has(root.id)) {
            currentX = positionFamily(root.id, currentX);
            // Mark all members of this family tree as positioned
            const q = [root.id];
            const visited = new Set([root.id]);
            while(q.length > 0) {
                const id = q.shift()!;
                positionedRoots.add(id);
                const partner = partnerMap.get(id);
                if (partner && !visited.has(partner)) { q.push(partner); visited.add(partner); }
                const children = childrenMap.get(id) || [];
                children.forEach(c => { if(!visited.has(c)) { q.push(c); visited.add(c); } });
            }
        }
    });

    const nodes: Node<Person>[] = people.map(p => ({
        id: p.id,
        type: 'timelinePerson',
        position: { x: xPositions.get(p.id) || 0, y: ((generations.get(p.id) ?? 1) - 1) * ROW_HEIGHT },
        data: p
    }));
  
    const edges: Edge[] = relationships.map(rel => {
        const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, nodes);
        return {
            id: rel.id, source, target, sourceHandle, targetHandle, type: edgeType,
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        };
    });
  
  const byGen = new Map<number, Person[]>();
  for (const person of people) {
    const gen = generations.get(person.id) ?? 1;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(person);
  }
  const axisInfo: { gen: number; y: number; yearRange: string }[] = [];
  for (const [gen, genPeople] of Array.from(byGen.entries()).sort(([a], [b]) => a - b)) {
    const birthYears = genPeople.map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null).filter((y): y is number => y !== null);
    const minYear = birthYears.length > 0 ? Math.min(...birthYears) : null;
    const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : null;
    const yearRange = minYear && maxYear ? (minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`) : '';
    axisInfo.push({ gen, y: (gen - 1) * ROW_HEIGHT, yearRange });
  }

  return { nodes, edges, axisInfo };
};

// --- Generation Axis ---
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
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden">
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


// --- Main Component ---
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
  const [axisInfo, setAxisInfo] = useState<{ gen: number; y: number; yearRange: string }[]>([]);
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  const { setViewport, fitView, getNode } = useReactFlow();

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
        buildTreeLayout(people, relationships, generations, edgeType, tree?.ownerPersonId);
      setNodes(newNodes);
      setEdges(newEdges);
      setAxisInfo(newAxisInfo);
      
      setTimeout(() => {
          fitView({ padding: 0.1, duration: 500 });
      }, 150);
      return;
    }

  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, fitView, tree?.ownerPersonId]);

  return (
    <div className="h-full w-full relative bg-background">
        <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />
      
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

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView={false}
        className={'ml-20'}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={4}
        nodesDraggable={true}
        nodesConnectable={false}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 }, type: edgeType }}
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
