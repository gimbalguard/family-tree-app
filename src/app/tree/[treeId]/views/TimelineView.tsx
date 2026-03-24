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
import { User } from 'lucide-react';

const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 120;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;
const NODE_WIDTH = 220;
const ROW_HEIGHT = 220;
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 80;
const FAMILY_GROUP_GAP = 100;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Generation Assignment ────────────────────────────────────────────────────
const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();
  const MAX_ITERATIONS = people.length * 3 + 10;
  let iterations = 0;
  let changesMade = true;

  // Build maps
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();
  const partnerMap = new Map<string, string[]>();

  for (const p of people) {
    parentMap.set(p.id, []);
    childMap.set(p.id, []);
    partnerMap.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childMap.get(rel.personAId)?.push(rel.personBId);
      parentMap.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnerMap.get(rel.personAId)?.push(rel.personBId);
      partnerMap.get(rel.personBId)?.push(rel.personAId);
    }
  }

  // Find the longest bloodline chain to determine the primary lineage
  const getChainLength = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    const children = childMap.get(personId) || [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(c => getChainLength(c, new Set(visited))));
  };

  // Roots = people with no parents
  const roots = people.filter(p => (parentMap.get(p.id) || []).length === 0);

  // Find the root of the longest chain — this is generation 1
  const rootChainLengths = roots.map(r => ({ id: r.id, length: getChainLength(r.id) }));
  rootChainLengths.sort((a, b) => b.length - a.length);

  // Assign generation 1 to the root of the longest chain
  // Other roots that connect via marriage will get their gen from their partner
  const primaryRootId = rootChainLengths[0]?.id;
  if (primaryRootId) {
    generations.set(primaryRootId, 1);
  }

  while (changesMade && iterations < MAX_ITERATIONS) {
    changesMade = false;
    iterations++;

    for (const person of people) {
      const currentGen = generations.get(person.id);

      // Priority 1: Parents
      const parentIds = parentMap.get(person.id) || [];
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

      // Priority 2: Partners
      const partnerIds = partnerMap.get(person.id) || [];
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

      // Priority 3: Siblings
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

    // Priority 4: Default — only for truly disconnected people
    for (const person of people) {
      if (!generations.has(person.id)) {
        generations.set(person.id, 1);
        changesMade = true;
      }
    }
  }

  return generations;
};

// ─── Edge handle logic ────────────────────────────────────────────────────────
const getEdgeProps = (
  rel: Relationship,
  positions: Map<string, { x: number; y: number }>
) => {
  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
    return {
      source: rel.personAId,
      target: rel.personBId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
  }

  const posA = positions.get(rel.personAId);
  const posB = positions.get(rel.personBId);
  const aX = posA?.x ?? 0;
  const bX = posB?.x ?? 0;
  const aIsLeft = aX <= bX;

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
  edgeType: EdgeType
): {
  nodes: Node<Person>[];
  edges: Edge[];
  axisInfo: { gen: number; y: number; yearRange: string }[];
} => {
  const personMap = new Map(people.map(p => [p.id, p]));

  // Group people by generation
  const byGen = new Map<number, Person[]>();
  for (const person of people) {
    const gen = generations.get(person.id) ?? 1;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(person);
  }

  const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
  const nodes: Node<Person>[] = [];
  const axisInfo: { gen: number; y: number; yearRange: string }[] = [];

  // Track X position assigned to each person (for centering children)
  const personXCenter = new Map<string, number>();

  for (const gen of sortedGens) {
    const yPos = (gen - 1) * ROW_HEIGHT;
    const peopleInGen = byGen.get(gen) || [];

    // Build birth year range label
    const birthYears = peopleInGen
      .map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null)
      .filter((y): y is number => y !== null);
    const minYear = birthYears.length > 0 ? Math.min(...birthYears) : null;
    const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : null;
    const yearRangeLabel = minYear && maxYear
      ? (minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`)
      : '';

    axisInfo.push({ gen, y: yPos, yearRange: yearRangeLabel });

    // Build family groups for this generation
    // A family group = a couple (or single) + their siblings in this row
    const processed = new Set<string>();
    const familyGroups: { couple: Person[]; singles: Person[] }[] = [];

    // First pass: find couples in this generation
    for (const person of peopleInGen) {
      if (processed.has(person.id)) continue;

      const partnerRel = relationships.find(r =>
        PARTNER_REL_TYPES.includes(r.relationshipType) &&
        (r.personAId === person.id || r.personBId === person.id)
      );
      const partnerId = partnerRel
        ? (partnerRel.personAId === person.id ? partnerRel.personBId : partnerRel.personAId)
        : null;
      const partner = partnerId ? personMap.get(partnerId) : null;
      const partnerInSameGen = partner && (generations.get(partner.id) === gen);

      if (partner && partnerInSameGen && !processed.has(partner.id)) {
        familyGroups.push({ couple: [person, partner], singles: [] });
        processed.add(person.id);
        processed.add(partner.id);
      }
    }

    // Second pass: remaining people are singles
    const singles: Person[] = [];
    for (const person of peopleInGen) {
      if (!processed.has(person.id)) {
        singles.push(person);
        processed.add(person.id);
      }
    }

    // Try to sort: if a person's parents are in the previous gen,
    // place them near their parents' X center
    // For now, attach singles to existing groups or create solo groups
    for (const single of singles) {
      // Check if this single has a sibling already in a group
      const siblingGroupIndex = familyGroups.findIndex(g =>
        [...g.couple, ...g.singles].some(p =>
          relationships.some(r =>
            SIBLING_REL_TYPES.includes(r.relationshipType) &&
            ((r.personAId === p.id && r.personBId === single.id) ||
             (r.personBId === p.id && r.personAId === single.id))
          )
        )
      );
      if (siblingGroupIndex >= 0) {
        familyGroups[siblingGroupIndex].singles.push(single);
      } else {
        familyGroups.push({ couple: [], singles: [single] });
      }
    }

    // Now lay out each family group left to right
    let currentX = 0;

    for (const group of familyGroups) {
      const allInGroup = [...group.couple, ...group.singles];
      const groupStartX = currentX;

      for (let i = 0; i < group.couple.length; i++) {
        const person = group.couple[i];
        const xPos = currentX;
        nodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: xPos, y: yPos },
          data: person,
          draggable: false,
        });
        personXCenter.set(person.id, xPos + NODE_WIDTH / 2);

        if (i < group.couple.length - 1) {
          // Check if separated
          const rel = relationships.find(r =>
            PARTNER_REL_TYPES.includes(r.relationshipType) &&
            ((r.personAId === person.id && r.personBId === group.couple[i + 1].id) ||
             (r.personBId === person.id && r.personAId === group.couple[i + 1].id))
          );
          const isSeparated = rel && ['ex_spouse', 'separated', 'ex_partner'].includes(rel.relationshipType);
          currentX += NODE_WIDTH + (isSeparated ? SEPARATED_GAP : SPOUSE_GAP);
        } else {
          currentX += NODE_WIDTH;
        }
      }

      if (group.couple.length > 0 && group.singles.length > 0) {
        currentX += SIBLING_GAP;
      }

      for (let i = 0; i < group.singles.length; i++) {
        const person = group.singles[i];
        const xPos = currentX;
        nodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: xPos, y: yPos },
          data: person,
          draggable: false,
        });
        personXCenter.set(person.id, xPos + NODE_WIDTH / 2);
        currentX += NODE_WIDTH + (i < group.singles.length - 1 ? SIBLING_GAP : 0);
      }

      currentX += FAMILY_GROUP_GAP;
    }
  }

  // Now reposition children to be centered under their parents
  // Do a second pass for each generation > 1
  for (const gen of sortedGens) {
    if (gen <= 1) continue;
    const peopleInGen = byGen.get(gen) || [];

    for (const person of peopleInGen) {
      const parentIds = relationships
        .filter(r => PARENT_REL_TYPES.includes(r.relationshipType) && r.personBId === person.id)
        .map(r => r.personAId);

      const parentXCenters = parentIds
        .map(id => personXCenter.get(id))
        .filter((x): x is number => x !== undefined);

      // We don't reposition here to avoid breaking sibling alignment
      // This is handled by the group ordering above
    }
  }

  // Build positions map for edge handle logic
  const positions = new Map<string, { x: number; y: number }>();

  nodes.forEach(node => {
    positions.set(node.id, node.position);
  });

  // Build edges
  const edges: Edge[] = relationships.map(rel => {
    const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, positions);
    return {
      id: rel.id,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: edgeType,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
    };
  });

  return { nodes, edges, axisInfo };
};

// ─── Generation Axis (fixed left panel) ──────────────────────────────────────
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
    <div
      className="absolute left-0 top-0 h-full w-28 bg-muted/20 z-10 select-none overflow-hidden"
    >
      <div className="relative h-full w-full" style={{ transform: `translateY(${viewportY}px)` }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => {
          const yPos = y * viewportZoom;
          const height = rowHeight * viewportZoom;
          return (
            <div
              key={gen}
              style={{ top: `${yPos}px`, height: `${height}px` }}
              className="absolute right-0 left-0 flex flex-col items-end justify-center pr-3 border-b border-border/20"
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
      const generations = assignGenerations(people, relationships);
      const { nodes: newNodes, edges: newEdges, axisInfo: newAxisInfo } =
        buildTreeLayout(people, relationships, generations, edgeType);
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
  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, setViewport, fitView, tree?.ownerPersonId]);

  return (
    <div className="h-full w-full relative bg-background">
      {isCompact && <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />}
      {!isCompact && (
        <TimelineAxis
          minYear={yearRange.min}
          maxYear={yearRange.max}
          pixelsPerYear={PIXELS_PER_YEAR}
        />
      )}

      {/* Owner controls — top right, only in compact mode */}
      {isCompact && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-sm">
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
                        setTimeout(() => {
                          fitView({
                            nodes: [{ id: person.id }],
                            duration: 600,
                            padding: 0.5,
                          });
                        }, 100);
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
        className={isCompact ? 'ml-28' : 'ml-20'}
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
