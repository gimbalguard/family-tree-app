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

// ─── Constants ────────────────────────────────────────────────────────────────
const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT_DEFAULT = 120;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;

const NODE_WIDTH = 160;
const ROW_HEIGHT = 240;
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 80;
const FAMILY_GROUP_GAP = 120;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Generation Assignment ────────────────────────────────────────────────────
// Priority (iterative until stable):
//   1. Has parents in tree  → gen = max(parent gen) + 1  [always wins]
//   2. No parents, has partner → same gen as partner
//   3. No parents, no partner, has sibling → same gen as sibling
//   4. Default → gen 1
//
// Seeds the root of the LONGEST bloodline chain at gen 1 first, so married-in
// people inherit from their spouse instead of defaulting to gen 1.
const assignGenerations = (
  people: Person[],
  relationships: Relationship[]
): Map<string, number> => {
  const generations = new Map<string, number>();

  // Build adjacency
  const parentMap = new Map<string, string[]>();   // personId → [parentIds]
  const childMap = new Map<string, string[]>();    // personId → [childIds]
  const partnerMap = new Map<string, string[]>();  // personId → [partnerIds]

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

  // Find longest bloodline chain — seed its root at gen 1
  const getChainLength = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    const children = childMap.get(personId) || [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(c => getChainLength(c, new Set(visited))));
  };

  const roots = people.filter(p => (parentMap.get(p.id) || []).length === 0);
  const rootsByChain = roots
    .map(r => ({ id: r.id, len: getChainLength(r.id) }))
    .sort((a, b) => b.len - a.len);

  // Seed only the primary root
  if (rootsByChain.length > 0) {
    generations.set(rootsByChain[0].id, 1);
  }

  // Iterative propagation until stable
  const MAX_ITER = people.length * 4 + 20;
  let changed = true;
  let iter = 0;

  while (changed && iter < MAX_ITER) {
    changed = false;
    iter++;

    for (const person of people) {
      const currentGen = generations.get(person.id);

      // Priority 1: parents always win — re-evaluate even if already assigned
      const parentIds = parentMap.get(person.id) || [];
      const parentGens = parentIds
        .map(id => generations.get(id))
        .filter((g): g is number => g !== undefined);

      if (parentGens.length > 0) {
        const wanted = Math.max(...parentGens) + 1;
        if (wanted !== currentGen) {
          generations.set(person.id, wanted);
          changed = true;
        }
        continue; // skip lower-priority rules for this person
      }

      if (currentGen !== undefined) continue; // already assigned by a previous iteration

      // Priority 2: partner
      const partnerIds = partnerMap.get(person.id) || [];
      const partnerGens = partnerIds
        .map(id => generations.get(id))
        .filter((g): g is number => g !== undefined);

      if (partnerGens.length > 0) {
        generations.set(person.id, Math.max(...partnerGens));
        changed = true;
        continue;
      }

      // Priority 3: sibling
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
        generations.set(person.id, Math.max(...siblingGens));
        changed = true;
        continue;
      }
    }

    // Priority 4: truly isolated — only if no partner can resolve them
    for (const person of people) {
      if (!generations.has(person.id)) {
        const partnerIds = partnerMap.get(person.id) || [];
        const hasReachablePartner = partnerIds.some(id => generations.has(id));
        if (!hasReachablePartner) {
          generations.set(person.id, 1);
          changed = true;
        }
      }
    }
  }

  // Final fallback
  for (const person of people) {
    if (!generations.has(person.id)) {
      generations.set(person.id, 1);
    }
  }

  return generations;
};

// ─── Edge handle routing ──────────────────────────────────────────────────────
// Parent→child : parent's bottom → child's top
// Spouse/sibling: closest horizontal side (left/right) based on X position
const getEdgeProps = (
  rel: Relationship,
  nodePositions: Map<string, { x: number; y: number }>
): { source: string; target: string; sourceHandle: string; targetHandle: string } => {
  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
    return {
      source: rel.personAId,
      target: rel.personBId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
  }

  const posA = nodePositions.get(rel.personAId);
  const posB = nodePositions.get(rel.personBId);
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

// ─── Layout algorithm ─────────────────────────────────────────────────────────
// Pure coordinate math — no dagre.
// Strategy:
//   1. Build parent/child/partner maps.
//   2. For each person, compute the "subtree width" they need recursively
//      (width of their children's subtrees, or NODE_WIDTH if leaf).
//   3. Walk from roots downward, assigning X positions:
//      - Couples placed side-by-side (SPOUSE_GAP or SEPARATED_GAP)
//      - Their children placed below them, centered under the couple
//      - Siblings spaced by SIBLING_GAP, family groups by FAMILY_GROUP_GAP
//   4. Y = (generation - 1) * ROW_HEIGHT
const buildCompactLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType
): {
  nodes: Node<Person>[];
  edges: Edge[];
  axisInfo: { gen: number; y: number; yearRange: string }[];
} => {
  // ── Adjacency maps ──
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();
  // Store ONE primary partner per person (first found, deterministic)
  const partnerOf = new Map<string, string>();
  // Store gap type for partner pairs
  const partnerGap = new Map<string, number>();

  for (const p of people) {
    parentMap.set(p.id, []);
    childMap.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childMap.get(rel.personAId)?.push(rel.personBId);
      parentMap.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      if (!partnerOf.has(rel.personAId)) {
        partnerOf.set(rel.personAId, rel.personBId);
        partnerOf.set(rel.personBId, rel.personAId);
        const gap = SEPARATED_REL_TYPES.includes(rel.relationshipType) ? SEPARATED_GAP : SPOUSE_GAP;
        const key = [rel.personAId, rel.personBId].sort().join('|');
        partnerGap.set(key, gap);
      }
    }
  }

  // ── Subtree width (for centering children under parents) ──
  // Width = how much horizontal space a person's entire descendant tree needs.
  const subtreeWidth = new Map<string, number>();

  const getSubtreeWidth = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return NODE_WIDTH;
    if (subtreeWidth.has(personId)) return subtreeWidth.get(personId)!;
    visited.add(personId);

    const partnerId = partnerOf.get(personId);
    const myChildren = childMap.get(personId) || [];
    const partnerChildren = partnerId ? (childMap.get(partnerId) || []) : [];
    // Deduplicated combined children of this couple
    const allChildren = [...new Set([...myChildren, ...partnerChildren])];
    // Remove children already visited (prevents cycles)
    const unvisitedChildren = allChildren.filter(c => !visited.has(c));

    let w: number;
    if (unvisitedChildren.length === 0) {
      // Leaf couple or single
      const coupleW = NODE_WIDTH + (partnerId ? (getPartnerGap(personId, partnerId) + NODE_WIDTH) : 0);
      w = coupleW + FAMILY_GROUP_GAP;
    } else {
      const childrenTotalW = unvisitedChildren.reduce((sum, cId) => {
        return sum + getSubtreeWidth(cId, new Set(visited));
      }, 0);
      const coupleW = NODE_WIDTH + (partnerId ? (getPartnerGap(personId, partnerId) + NODE_WIDTH) : 0);
      w = Math.max(coupleW + FAMILY_GROUP_GAP, childrenTotalW);
    }

    subtreeWidth.set(personId, w);
    return w;
  };

  const getPartnerGap = (a: string, b: string): number => {
    const key = [a, b].sort().join('|');
    return partnerGap.get(key) ?? SPOUSE_GAP;
  };

  // Pre-calculate widths starting from roots
  const roots = people.filter(p => (parentMap.get(p.id) || []).length === 0);
  for (const r of roots) getSubtreeWidth(r.id);

  // ── Assign X positions ──
  const xPos = new Map<string, number>();
  const assigned = new Set<string>();

  const assignX = (personId: string, leftEdge: number, visited = new Set<string>()): void => {
    if (assigned.has(personId) || visited.has(personId)) return;
    visited.add(personId);
    assigned.add(personId);

    const partnerId = partnerOf.get(personId);
    const myChildren = childMap.get(personId) || [];
    const partnerChildren = partnerId ? (childMap.get(partnerId) || []) : [];
    const allChildren = [...new Set([...myChildren, ...partnerChildren])];
    const unvisitedChildren = allChildren.filter(c => !assigned.has(c));

    if (unvisitedChildren.length === 0) {
      // Leaf: place self, then partner
      xPos.set(personId, leftEdge);
      if (partnerId && !assigned.has(partnerId)) {
        assigned.add(partnerId);
        visited.add(partnerId);
        xPos.set(partnerId, leftEdge + NODE_WIDTH + getPartnerGap(personId, partnerId));
      }
      return;
    }

    // Place children first
    let childCursor = leftEdge;
    for (const childId of unvisitedChildren) {
      const cw = subtreeWidth.get(childId) ?? (NODE_WIDTH + FAMILY_GROUP_GAP);
      assignX(childId, childCursor, new Set(visited));
      childCursor += cw;
    }

    // Center this person (and partner) above children
    const childXValues = unvisitedChildren
      .map(c => xPos.get(c))
      .filter((x): x is number => x !== undefined);

    if (childXValues.length === 0) {
      xPos.set(personId, leftEdge);
      return;
    }

    const minCX = Math.min(...childXValues);
    const maxCX = Math.max(...childXValues);
    const childrenCenter = (minCX + maxCX) / 2;

    if (partnerId && !assigned.has(partnerId)) {
      assigned.add(partnerId);
      visited.add(partnerId);
      const gap = getPartnerGap(personId, partnerId);
      const coupleW = NODE_WIDTH * 2 + gap;
      const coupleLeft = childrenCenter - coupleW / 2;
      xPos.set(personId, coupleLeft);
      xPos.set(partnerId, coupleLeft + NODE_WIDTH + gap);
    } else {
      xPos.set(personId, childrenCenter);
    }
  };

  // Walk roots left to right
  let cursor = 0;
  for (const root of roots) {
    if (!assigned.has(root.id)) {
      assignX(root.id, cursor);
      // Advance cursor past this subtree
      const w = subtreeWidth.get(root.id) ?? (NODE_WIDTH + FAMILY_GROUP_GAP);
      cursor += w;
    }
  }

  // Place any remaining (fully disconnected)
  for (const p of people) {
    if (!assigned.has(p.id)) {
      xPos.set(p.id, cursor);
      assigned.add(p.id);
      cursor += NODE_WIDTH + SIBLING_GAP;
    }
  }

  // ── Build node positions map (for edge routing) ──
  const nodePositions = new Map<string, { x: number; y: number }>();

  const nodes: Node<Person>[] = people.map(person => {
    const gen = generations.get(person.id) ?? 1;
    const y = (gen - 1) * ROW_HEIGHT;
    const x = xPos.get(person.id) ?? 0;
    nodePositions.set(person.id, { x, y });
    return {
      id: person.id,
      type: 'timelinePerson',
      position: { x, y },
      data: person,
      draggable: false,
    };
  });

  // ── Build edges ──
  const edges: Edge[] = relationships
    .filter(rel =>
      people.some(p => p.id === rel.personAId) &&
      people.some(p => p.id === rel.personBId)
    )
    .map(rel => {
      const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, nodePositions);
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

  // ── Axis info ──
  const byGen = new Map<number, Person[]>();
  for (const person of people) {
    const gen = generations.get(person.id) ?? 1;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(person);
  }

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

// ─── Generation Axis (fixed left panel, synced to canvas transform) ───────────
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
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden pointer-events-none">
      <div
        className="relative w-full"
        style={{ transform: `translateY(${viewportY}px)`, height: '10000px' }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => {
          const yPos = y * viewportZoom;
          const height = rowHeight * viewportZoom;
          return (
            <div
              key={gen}
              style={{ top: `${yPos}px`, height: `${height}px` }}
              className="absolute right-0 left-0 flex flex-col items-center justify-center px-1 border-b border-border/20 text-center"
            >
              <span className="text-sm font-bold text-foreground leading-none">דור {gen}</span>
              {yearRange && (
                <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">{yearRange}</span>
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
interface ContextMenuState {
  x: number;
  y: number;
  personId: string;
}

const TimelineContextMenu = ({
  menu,
  onOpenCard,
  onClose,
}: {
  menu: ContextMenuState;
  onOpenCard: (id: string) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[160px]"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        className="w-full text-right px-4 py-2 text-sm hover:bg-muted transition-colors"
        onClick={() => { onOpenCard(menu.personId); onClose(); }}
      >
        פתח כרטיס
      </button>
    </div>
  );
};

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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const { setViewport, fitView, getNode } = useReactFlow();
  const hasFitOnLoad = useRef(false);

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({
      nodes: [{ id: tree.ownerPersonId }],
      duration: 600,
      padding: 0.5,
    });
  }, [tree?.ownerPersonId, fitView]);

  // ── Compact (generational) mode ──
  const buildCompact = useCallback(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      setAxisInfo([]);
      return;
    }
    const generations = assignGenerations(people, relationships);
    const { nodes: newNodes, edges: newEdges, axisInfo: newAxisInfo } =
      buildCompactLayout(people, relationships, generations, edgeType);
    setNodes(newNodes);
    setEdges(newEdges);
    setAxisInfo(newAxisInfo);
  }, [people, relationships, edgeType, setNodes, setEdges]);

  // ── Default (year-based) timeline mode — UNCHANGED ──
  const buildYearBased = useCallback(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

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
    const minYear = validBirthYears.length > 0
      ? Math.min(...validBirthYears) - 5
      : new Date().getFullYear() - 50;
    const maxYear = validBirthYears.length > 0
      ? Math.max(...validBirthYears, new Date().getFullYear()) + 5
      : new Date().getFullYear();
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
      const peopleInGen = (peopleByGeneration.get(gen) || [])
        .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
      const xPos = 100 + (gen - 1) * COLUMN_WIDTH;
      lastOccupiedYinColumn.set(gen, -Infinity);

      for (const person of peopleInGen) {
        const idealY = person.birthYear !== null
          ? (person.birthYear - minYear) * PIXELS_PER_YEAR
          : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP;
        const lastY = lastOccupiedYinColumn.get(gen)!;
        const yPos = Math.max(idealY, lastY + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP);
        newNodes.push({ id: person.id, type: 'timelinePerson', position: { x: xPos, y: yPos }, data: person });
        lastOccupiedYinColumn.set(gen, yPos);
      }
    }

    const hadNoNodes = nodes.length === 0;
    setNodes(newNodes);
    setEdges(relationships.map(rel => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: edgeType,
      animated: PARENT_REL_TYPES.includes(rel.relationshipType),
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })));

    if (hadNoNodes && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, edgeType, setNodes, setEdges, setViewport]);

  useEffect(() => {
    hasFitOnLoad.current = false;
    if (isCompact) {
      buildCompact();
      setTimeout(() => {
        if (!hasFitOnLoad.current) {
          hasFitOnLoad.current = true;
          fitView({ padding: 0.12, duration: 500 });
        }
      }, 200);
    } else {
      buildYearBased();
    }
  }, [isCompact, buildCompact, buildYearBased, fitView]);

  // Handle right-click on a node → context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<Person>) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, personId: node.id });
  }, []);

  // Open card via context menu (calls the same double-click handler)
  const handleOpenCardFromMenu = useCallback((personId: string) => {
    const person = people.find(p => p.id === personId);
    if (person && onNodeDoubleClick) {
      const fakeNode = { id: personId, data: person } as Node<Person>;
      onNodeDoubleClick(new MouseEvent('dblclick') as any, fakeNode);
    }
  }, [people, onNodeDoubleClick]);

  return (
    <div
      className="h-full w-full relative bg-background"
      onClick={() => setContextMenu(null)}
    >
      {/* Generation axis — compact mode only */}
      {isCompact && <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />}

      {/* Year axis — non-compact mode only */}
      {!isCompact && (
        <TimelineAxis
          minYear={yearRange.min}
          maxYear={yearRange.max}
          pixelsPerYear={PIXELS_PER_YEAR}
        />
      )}

      {/* Control buttons — compact mode, top-right */}
      {isCompact && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={centerOnOwner}
                disabled={!tree?.ownerPersonId}
                title="מרכז עליי"
              >
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
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView={false}
        className={isCompact ? 'ml-20' : 'ml-20'}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={4}
        nodesDraggable={false}
        nodesConnectable={false}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 1.5 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>

      {/* Right-click context menu */}
      {contextMenu && (
        <TimelineContextMenu
          menu={contextMenu}
          onOpenCard={handleOpenCardFromMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────
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