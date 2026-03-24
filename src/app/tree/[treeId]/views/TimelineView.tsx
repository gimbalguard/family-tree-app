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
  ConnectionMode,
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
import { User, Eye } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 120;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;
const NODE_WIDTH = 160;   // matches card width
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

  // Find the longest bloodline chain to determine the primary lineage root
  const getChainLength = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    const children = childMap.get(personId) || [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(c => getChainLength(c, new Set(visited))));
  };

  // Roots = people with no parents in the tree
  const roots = people.filter(p => (parentMap.get(p.id) || []).length === 0);

  const rootChainLengths = roots.map(r => ({ id: r.id, length: getChainLength(r.id) }));
  rootChainLengths.sort((a, b) => b.length - a.length);

  // Only assign gen 1 to the primary bloodline root; all others will inherit from partners
  const primaryRootId = rootChainLengths[0]?.id;
  if (primaryRootId) {
    generations.set(primaryRootId, 1);
  }

  while (changesMade && iterations < MAX_ITERATIONS) {
    changesMade = false;
    iterations++;

    for (const person of people) {
      const currentGen = generations.get(person.id);

      // Priority 1: Parents (strongest signal)
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

      // Priority 2: Partners (married-in people get same gen as their spouse)
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
        .filter(r =>
          SIBLING_REL_TYPES.includes(r.relationshipType) &&
          (r.personAId === person.id || r.personBId === person.id)
        )
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

    // Priority 4: Fallback only for truly isolated people
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
// Returns source/target and which handle IDs to use.
// Parent→Child: parent bottom → child top
// Spouse/Sibling: left person right → right person left
const getEdgeHandles = (
  rel: Relationship,
  positions: Map<string, { x: number; y: number }>
): { source: string; target: string; sourceHandle: string; targetHandle: string } => {
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
  edgeType: EdgeType,
  hiddenPersonIds: Set<string>
): {
  nodes: Node<Person>[];
  edges: Edge[];
  axisInfo: { gen: number; y: number; yearRange: string }[];
} => {
  // Filter out hidden people
  const visiblePeople = people.filter(p => !hiddenPersonIds.has(p.id));
  const visibleIds = new Set(visiblePeople.map(p => p.id));
  const visibleRels = relationships.filter(
    r => !hiddenPersonIds.has(r.personAId) && !hiddenPersonIds.has(r.personBId)
  );

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string[]>();
  // Only store primary partner (first found) per person for layout
  const partnerMap = new Map<string, string>();
  const partnerRelMap = new Map<string, Relationship>();

  for (const person of visiblePeople) {
    childrenMap.set(person.id, []);
    parentMap.set(person.id, []);
  }

  for (const rel of visibleRels) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      if (visibleIds.has(rel.personAId) && visibleIds.has(rel.personBId)) {
        childrenMap.get(rel.personAId)?.push(rel.personBId);
        parentMap.get(rel.personBId)?.push(rel.personAId);
      }
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      if (visibleIds.has(rel.personAId) && visibleIds.has(rel.personBId)) {
        if (!partnerMap.has(rel.personAId)) {
          partnerMap.set(rel.personAId, rel.personBId);
          partnerRelMap.set(rel.personAId, rel);
        }
        if (!partnerMap.has(rel.personBId)) {
          partnerMap.set(rel.personBId, rel.personAId);
          partnerRelMap.set(rel.personBId, rel);
        }
      }
    }
  }

  // Assign X positions using recursive subtree layout
  const xPositions = new Map<string, number>();
  let currentX = 0;
  const assignedInLayout = new Set<string>();

  const getIsSeparated = (personId: string, partnerId: string): boolean => {
    const rel = partnerRelMap.get(personId) || partnerRelMap.get(partnerId);
    return !!(rel && SEPARATED_REL_TYPES.includes(rel.relationshipType));
  };

  const assignX = (personId: string, visited = new Set<string>()): void => {
    if (visited.has(personId) || xPositions.has(personId)) return;
    visited.add(personId);
    assignedInLayout.add(personId);

    const partnerId = partnerMap.get(personId);
    const children = childrenMap.get(personId) || [];
    const partnerChildren = partnerId ? (childrenMap.get(partnerId) || []) : [];
    const allChildren = [...new Set([...children, ...partnerChildren])].filter(
      id => visibleIds.has(id)
    );

    if (allChildren.length === 0) {
      // Leaf: place self then partner
      xPositions.set(personId, currentX);
      currentX += NODE_WIDTH + SIBLING_GAP;

      if (partnerId && !xPositions.has(partnerId)) {
        const isSep = getIsSeparated(personId, partnerId);
        const gap = isSep ? SEPARATED_GAP : SPOUSE_GAP;
        xPositions.set(partnerId, currentX);
        currentX += NODE_WIDTH + FAMILY_GROUP_GAP;
        assignedInLayout.add(partnerId);
      }
      return;
    }

    // Recurse into children first
    for (const childId of allChildren) {
      if (!xPositions.has(childId)) assignX(childId, new Set(visited));
    }

    const childXs = allChildren
      .map(cId => xPositions.get(cId))
      .filter((x): x is number => x !== undefined);

    if (childXs.length === 0) {
      xPositions.set(personId, currentX);
      currentX += NODE_WIDTH + SIBLING_GAP;
      return;
    }

    const minChildX = Math.min(...childXs);
    const maxChildX = Math.max(...childXs);
    const centerX = (minChildX + maxChildX) / 2;

    if (partnerId && !xPositions.has(partnerId)) {
      const isSep = getIsSeparated(personId, partnerId);
      const gap = isSep ? SEPARATED_GAP : SPOUSE_GAP;
      const coupleWidth = NODE_WIDTH * 2 + gap;
      const leftX = centerX - coupleWidth / 2;
      xPositions.set(personId, leftX);
      xPositions.set(partnerId, leftX + NODE_WIDTH + gap);
      assignedInLayout.add(partnerId);
      // Advance currentX if the partner block extends beyond it
      currentX = Math.max(currentX, leftX + coupleWidth + FAMILY_GROUP_GAP);
    } else {
      xPositions.set(personId, centerX - NODE_WIDTH / 2);
      currentX = Math.max(currentX, centerX + NODE_WIDTH / 2 + SIBLING_GAP);
    }
  };

  const roots = visiblePeople.filter(p => (parentMap.get(p.id) || []).length === 0);
  for (const root of roots) {
    if (!xPositions.has(root.id)) assignX(root.id);
  }
  // Any remaining (e.g. circular references or not reachable from roots)
  for (const person of visiblePeople) {
    if (!xPositions.has(person.id)) {
      xPositions.set(person.id, currentX);
      currentX += NODE_WIDTH + SIBLING_GAP;
    }
  }

  // Build positions map (needed for edge handle decisions)
  const positions = new Map<string, { x: number; y: number }>();

  const nodes: Node<Person>[] = visiblePeople.map(person => {
    const gen = generations.get(person.id) ?? 1;
    const y = (gen - 1) * ROW_HEIGHT;
    const x = xPositions.get(person.id) ?? 0;
    positions.set(person.id, { x, y });
    return {
      id: person.id,
      type: 'timelinePerson',
      position: { x, y },
      data: person,
      draggable: false,
    };
  });

  // Build axis info
  const byGen = new Map<number, Person[]>();
  for (const person of visiblePeople) {
    const gen = generations.get(person.id) ?? 1;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(person);
  }

  const axisInfo: { gen: number; y: number; yearRange: string }[] = [];
  for (const [gen, genPeople] of Array.from(byGen.entries()).sort(([a], [b]) => a - b)) {
    const birthYears = genPeople
      .map(p =>
        p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null
      )
      .filter((y): y is number => y !== null);
    const minYear = birthYears.length > 0 ? Math.min(...birthYears) : null;
    const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : null;
    const yearRange =
      minYear && maxYear
        ? minYear === maxYear
          ? `${minYear}`
          : `${minYear}–${maxYear}`
        : '';
    axisInfo.push({ gen, y: (gen - 1) * ROW_HEIGHT, yearRange });
  }

  // Build edges — now that positions are fully populated
  const edges: Edge[] = visibleRels
    .filter(rel => visibleIds.has(rel.personAId) && visibleIds.has(rel.personBId))
    .map(rel => {
      const { source, target, sourceHandle, targetHandle } = getEdgeHandles(rel, positions);
      const isParent = PARENT_REL_TYPES.includes(rel.relationshipType);
      return {
        id: rel.id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: edgeType,
        style: {
          stroke: isParent ? '#64748b' : '#94a3b8',
          strokeWidth: isParent ? 2 : 1.5,
          strokeDasharray: SEPARATED_REL_TYPES.includes(rel.relationshipType) ? '5,4' : undefined,
        },
        animated: false,
        markerEnd: undefined,
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
  const viewportY = transform[1];
  const viewportZoom = transform[2];

  return (
    <div
      className="absolute left-0 top-0 h-full z-10 select-none overflow-hidden pointer-events-none"
      style={{ width: 112 }}
    >
      <div
        className="relative w-full"
        style={{
          transform: `translateY(${viewportY}px)`,
          // Make this container tall enough to cover all rows
          height: axisInfo.length > 0
            ? (Math.max(...axisInfo.map(a => a.gen)) * rowHeight * viewportZoom) + 300
            : '100%',
        }}
      >
        {/* Right border line */}
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
              <span className="text-sm font-bold text-foreground leading-none whitespace-nowrap">
                דור {gen}
              </span>
              {yearRange && (
                <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                  {yearRange}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
GenerationAxis.displayName = 'GenerationAxis';

// ─── Context Menu ─────────────────────────────────────────────────────────────
const ContextMenu = memo(({
  x, y, personId, onOpenCard, onHide, onClose,
}: {
  x: number;
  y: number;
  personId: string;
  onOpenCard: (id: string) => void;
  onHide: (id: string) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px] text-sm"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-right px-3 py-1.5 hover:bg-accent transition-colors"
        onClick={() => { onOpenCard(personId); onClose(); }}
      >
        פתח כרטיס
      </button>
      <button
        className="w-full text-right px-3 py-1.5 hover:bg-accent transition-colors text-muted-foreground"
        onClick={() => { onHide(personId); onClose(); }}
      >
        הסתר אדם
      </button>
    </div>
  );
});
ContextMenu.displayName = 'ContextMenu';

// ─── Empty Canvas Context Menu ────────────────────────────────────────────────
const CanvasContextMenu = memo(({
  x, y, onShowAll, onClose,
}: {
  x: number;
  y: number;
  onShowAll: () => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[180px] text-sm"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-right px-3 py-1.5 hover:bg-accent transition-colors"
        onClick={() => { onShowAll(); onClose(); }}
      >
        הצג אנשים מוסתרים
      </button>
    </div>
  );
});
CanvasContextMenu.displayName = 'CanvasContextMenu';

// Need to import useEffect for context menus
import { useEffect } from 'react';

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
  const [hiddenPersonIds, setHiddenPersonIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; personId: string } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);

  const { fitView, getNode } = useReactFlow();
  const hasCenteredOnOwner = useRef(false);

  // Build compact (generational) layout
  useEffect(() => {
    if (!isCompact) return;
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      setAxisInfo([]);
      return;
    }

    const generations = assignGenerations(people, relationships);
    const { nodes: newNodes, edges: newEdges, axisInfo: newAxisInfo } =
      buildTreeLayout(people, relationships, generations, edgeType, hiddenPersonIds);

    setNodes(newNodes);
    setEdges(newEdges);
    setAxisInfo(newAxisInfo);

    setTimeout(() => {
      if (tree?.ownerPersonId && !hasCenteredOnOwner.current) {
        hasCenteredOnOwner.current = true;
        fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
      } else {
        fitView({ padding: 0.12, duration: 500 });
      }
    }, 150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, edgeType, isCompact, hiddenPersonIds]);

  // Build original year-based timeline layout
  useEffect(() => {
    if (isCompact) return;

    hasCenteredOnOwner.current = false;

    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const generations = assignGenerations(people, relationships);
    const peopleWithData = people
      .map(p => {
        const date = p.birthDate ? parseISO(p.birthDate) : null;
        return {
          ...p,
          birthYear: date && isValid(date) ? getYear(date) : null,
          generation: generations.get(p.id) || 0,
        };
      })
      .filter(p => p.generation > 0);

    const validBirthYears = peopleWithData
      .map(p => p.birthYear)
      .filter((y): y is number => y !== null);
    const minYear =
      validBirthYears.length > 0
        ? Math.min(...validBirthYears) - 5
        : new Date().getFullYear() - 50;
    const maxYear =
      validBirthYears.length > 0
        ? Math.max(...validBirthYears, new Date().getFullYear()) + 5
        : new Date().getFullYear();
    setYearRange({ min: minYear, max: maxYear });

    const peopleByGeneration = new Map<number, typeof peopleWithData>();
    for (const person of peopleWithData) {
      if (!peopleByGeneration.has(person.generation))
        peopleByGeneration.set(person.generation, []);
      peopleByGeneration.get(person.generation)!.push(person);
    }

    const newNodes: Node<Person>[] = [];
    const sortedGenerationKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);
    const lastOccupiedYinColumn = new Map<number, number>();

    for (const gen of sortedGenerationKeys) {
      if (gen === 0) continue;
      const peopleInGen = (peopleByGeneration.get(gen) || []).sort(
        (a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999)
      );
      const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
      lastOccupiedYinColumn.set(gen, -Infinity);

      for (const person of peopleInGen) {
        const idealY =
          person.birthYear !== null
            ? (person.birthYear - minYear) * PIXELS_PER_YEAR
            : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
        const lastY = lastOccupiedYinColumn.get(gen)!;
        const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
        newNodes.push({
          id: person.id,
          type: 'timelinePerson',
          position: { x: xPos, y: yPos },
          data: person,
        });
        lastOccupiedYinColumn.set(gen, yPos);
      }
    }

    setNodes(newNodes);
    setEdges(
      relationships.map(rel => ({
        id: rel.id,
        source: rel.personAId,
        target: rel.personBId,
        type: edgeType,
        animated: PARENT_REL_TYPES.includes(rel.relationshipType),
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, edgeType, isCompact]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setCanvasContextMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY, personId: node.id });
  }, []);

  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    if (hiddenPersonIds.size === 0) return;
    event.preventDefault();
    setContextMenu(null);
    setCanvasContextMenu({ x: event.clientX, y: event.clientY });
  }, [hiddenPersonIds.size]);

  const handleHidePerson = useCallback((personId: string) => {
    setHiddenPersonIds(prev => new Set([...prev, personId]));
  }, []);

  const handleShowAllHidden = useCallback(() => {
    setHiddenPersonIds(new Set());
  }, []);

  const handleOpenCard = useCallback((personId: string) => {
    // Find the node and trigger the double-click handler
    const node = nodes.find(n => n.id === personId);
    if (node && onNodeDoubleClick) {
      onNodeDoubleClick({} as any, node);
    }
  }, [nodes, onNodeDoubleClick]);

  return (
    <div className="h-full w-full relative bg-background">
      {/* Generation axis — only in compact mode */}
      {isCompact && <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />}

      {/* Year axis — only in non-compact mode */}
      {!isCompact && (
        <TimelineAxis
          minYear={yearRange.min}
          maxYear={yearRange.max}
          pixelsPerYear={PIXELS_PER_YEAR}
        />
      )}

      {/* "Who am I" button — top right, compact mode only */}
      {isCompact && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-sm">
          {hiddenPersonIds.size > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={`הצג ${hiddenPersonIds.size} אנשים מוסתרים`}
              onClick={handleShowAllHidden}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
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
        onNodeContextMenu={isCompact ? handleNodeContextMenu : undefined}
        onPaneContextMenu={isCompact ? handlePaneContextMenu : undefined}
        onPaneClick={() => {
          setContextMenu(null);
          setCanvasContextMenu(null);
        }}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView={false}
        className={isCompact ? 'ml-28' : 'ml-20'}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={4}
        nodesDraggable={false}
        nodesConnectable={false}
        defaultEdgeOptions={{
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>

      {/* Node context menu */}
      {contextMenu && isCompact && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          personId={contextMenu.personId}
          onOpenCard={handleOpenCard}
          onHide={handleHidePerson}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Canvas context menu (show hidden) */}
      {canvasContextMenu && isCompact && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onShowAll={handleShowAllHidden}
          onClose={() => setCanvasContextMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
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