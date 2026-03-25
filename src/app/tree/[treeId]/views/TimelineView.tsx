'use client';
import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
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

const PIXELS_PER_YEAR     = 80;
const NODE_HEIGHT_DEFAULT = 120;
const MIN_VERTICAL_GAP    = 16;
const COLUMN_WIDTH        = 300;
const NODE_WIDTH          = 160;
const ROW_HEIGHT          = 220;
const SPOUSE_GAP          = 8;    // gap between married couple cards
const SEPARATED_GAP       = 24;   // gap for separated/divorced couples
const SIBLING_GAP         = 16;   // gap between siblings
const FAMILY_GROUP_GAP    = 32;   // gap between unrelated root families

const PARENT_REL_TYPES    = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES   = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES   = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

const buildEdgeFromPositions = (
  rel: Relationship,
  xPositions: Map<string, number>,
  edgeType: EdgeType
): Edge => {
  const aX = xPositions.get(rel.personAId) ?? 0;
  const bX = xPositions.get(rel.personBId) ?? 0;
  let sourceHandle: string;
  let targetHandle: string;
  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
    sourceHandle = 'bottom';
    targetHandle = 'top';
  } else {
    const aIsLeft = (aX + NODE_WIDTH / 2) <= (bX + NODE_WIDTH / 2);
    sourceHandle  = aIsLeft ? 'right' : 'left';
    targetHandle  = aIsLeft ? 'left'  : 'right';
  }
  return {
    id: rel.id,
    source: rel.personAId, sourceHandle,
    target: rel.personBId, targetHandle,
    type: edgeType,
    className: 'custom-edge',
    style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
  };
};

// ─── Generation Assignment ─────────────────────────────────────────────────────
// THE CORRECT ALGORITHM (as used by every genealogy app):
//
// PHASE 1 — Build adjacency maps (parent→child, partner).
//
// PHASE 2 — Find the single "deepest root": the person with no parents who
//   heads the longest parent→child chain. They get generation 1.
//   ALL other people get their generation purely from this root downward.
//
// PHASE 3 — BFS downward from every known-generation person:
//   child gen = parent gen + 1  (hard rule, always wins)
//
// PHASE 4 — Propagate partners: partner gets same gen as their spouse.
//   This handles married-in people with no parents in the tree.
//
// PHASE 5 — Propagate upward for ancestors of already-placed people:
//   parent gen = min(children gens) - 1
//   Only runs AFTER partners are placed, so a married-in person whose
//   spouse was placed by bloodline is already correct before this step.
//
// PHASE 6 — Hard-enforce: every partner pair MUST be same generation.
//   The one derived from a bloodline (has parents OR children that are
//   bloodline-connected) wins. The other is moved to match.
//
// PHASE 7 — Normalize so minimum = 1.
//
// Repeat phases 3-5 until stable (handles multi-hop chains).
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  ownerId?: string
): Map<string, number> => {
  const gen = new Map<string, number>();

  // Phase 1: adjacency
  const parentsOf  = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, string[]>();

  for (const p of people) {
    parentsOf.set(p.id, []);
    childrenOf.set(p.id, []);
    partnersOf.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      // personAId = parent, personBId = child (schema confirmed)
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnersOf.get(rel.personAId)?.push(rel.personBId);
      partnersOf.get(rel.personBId)?.push(rel.personAId);
    }
  }

  // Phase 2: seed the single deepest root at generation 1
  // (or the owner if set — anchored at 100 so ancestors can go below without
  //  hitting negative numbers, then normalized at the end)
  const chainLen = (id: string, vis = new Set<string>()): number => {
    if (vis.has(id)) return 0;
    vis.add(id);
    const ch = childrenOf.get(id) || [];
    return ch.length ? 1 + Math.max(...ch.map(c => chainLen(c, new Set(vis)))) : 1;
  };

  if (ownerId && people.some(p => p.id === ownerId)) {
    gen.set(ownerId, 100);
  } else {
    // All people with no parents = candidate roots
    const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
    if (roots.length) {
      // Seed ALL roots at generation 1 — we'll let BFS settle them correctly
      // via upward propagation. The key is the deepest root wins because
      // it will push other roots' generations up via shared descendants.
      for (const r of roots) gen.set(r.id, 1);
    }
  }

  // Phases 3–5: iterate until stable
  const MAX_ITER = people.length * 4 + 20;
  let changed = true;
  let iter = 0;

  while (changed && iter++ < MAX_ITER) {
    changed = false;

    // Phase 3: downward — child = max(parent gens) + 1 (ALWAYS wins)
    for (const p of people) {
      const parentGens = (parentsOf.get(p.id) || [])
        .map(id => gen.get(id))
        .filter((g): g is number => g !== undefined);
      if (parentGens.length) {
        const want = Math.max(...parentGens) + 1;
        if (gen.get(p.id) !== want) { gen.set(p.id, want); changed = true; }
      }
    }

    // Phase 4: partner propagation — spouse gets same gen as partner
    // Only assign if not yet assigned or if partner has parents (bloodline wins)
    for (const p of people) {
      if (gen.has(p.id)) continue; // already placed by bloodline
      const partnerGens = (partnersOf.get(p.id) || [])
        .map(id => gen.get(id))
        .filter((g): g is number => g !== undefined);
      if (partnerGens.length) {
        gen.set(p.id, Math.max(...partnerGens));
        changed = true;
      }
    }

    // Phase 5: upward — parent = min(children gens) - 1
    // Only for people not yet placed (true disconnected ancestors)
    for (const p of people) {
      if (gen.has(p.id)) continue;
      const childGens = (childrenOf.get(p.id) || [])
        .map(id => gen.get(id))
        .filter((g): g is number => g !== undefined);
      if (childGens.length) {
        gen.set(p.id, Math.min(...childGens) - 1);
        changed = true;
      }
    }

    // Sibling propagation
    for (const p of people) {
      if (gen.has(p.id)) continue;
      const sibIds = relationships
        .filter(r => SIBLING_REL_TYPES.includes(r.relationshipType) &&
          (r.personAId === p.id || r.personBId === p.id))
        .map(r => r.personAId === p.id ? r.personBId : r.personAId);
      const sibGens = sibIds.map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (sibGens.length) {
        gen.set(p.id, Math.max(...sibGens));
        changed = true;
      }
    }
  }

  // Fallback: truly isolated people
  for (const p of people) {
    if (!gen.has(p.id)) gen.set(p.id, 1);
  }

  // Phase 6: HARD ENFORCE — every partner pair must be on the same row.
  // Rule: the person derived from the bloodline (has parents in tree) wins.
  // If both have parents, the one with deeper ancestry wins (higher gen number).
  // If neither has parents, keep the one with children.
  let enforceChanged = true;
  let enforceIter = 0;
  while (enforceChanged && enforceIter++ < people.length + 10) {
    enforceChanged = false;
    for (const rel of relationships) {
      if (!PARTNER_REL_TYPES.includes(rel.relationshipType)) continue;
      const gA = gen.get(rel.personAId);
      const gB = gen.get(rel.personBId);
      if (gA === undefined || gB === undefined || gA === gB) continue;

      const aParents = (parentsOf.get(rel.personAId) || []).length;
      const bParents = (parentsOf.get(rel.personBId) || []).length;

      let target: number;
      if (aParents > 0 && bParents === 0) {
        target = gA; // A is bloodline, B is married-in
      } else if (bParents > 0 && aParents === 0) {
        target = gB; // B is bloodline, A is married-in
      } else if (aParents > 0 && bParents > 0) {
        // Both have parents — use the one with more parents (deeper ancestry)
        target = gA > gB ? gA : gB;
      } else {
        // Neither has parents — keep the one whose children determine their row
        const aChildren = (childrenOf.get(rel.personAId) || []).length;
        const bChildren = (childrenOf.get(rel.personBId) || []).length;
        target = aChildren >= bChildren ? gA : gB;
      }

      if (gA !== target) { gen.set(rel.personAId, target); enforceChanged = true; }
      if (gB !== target) { gen.set(rel.personBId, target); enforceChanged = true; }
    }

    // After adjusting partners, re-run downward pass to fix their children
    for (const p of people) {
      const parentGens = (parentsOf.get(p.id) || [])
        .map(id => gen.get(id))
        .filter((g): g is number => g !== undefined);
      if (parentGens.length) {
        const want = Math.max(...parentGens) + 1;
        if (gen.get(p.id) !== want) { gen.set(p.id, want); enforceChanged = true; }
      }
    }
  }

  // Phase 7: normalize so minimum = 1
  const allGens = Array.from(gen.values());
  const minG = Math.min(...allGens);
  if (minG !== 1) {
    const shift = 1 - minG;
    for (const [id, g] of gen) gen.set(id, g + shift);
  }

  return gen;
};

const buildCompactLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType
) => {
  const parentsOf  = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnerOf  = new Map<string, string>();
  const gapOf      = new Map<string, number>();

  for (const p of people) { parentsOf.set(p.id, []); childrenOf.set(p.id, []); }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      if (!partnerOf.has(rel.personAId)) {
        partnerOf.set(rel.personAId, rel.personBId);
        partnerOf.set(rel.personBId, rel.personAId);
        const gap = SEPARATED_REL_TYPES.includes(rel.relationshipType) ? SEPARATED_GAP : SPOUSE_GAP;
        gapOf.set([rel.personAId, rel.personBId].sort().join('|'), gap);
      }
    }
  }

  const pGap = (a: string, b: string) => gapOf.get([a, b].sort().join('|')) ?? SPOUSE_GAP;

  const sw = new Map<string, number>();
  const widthCounted = new Set<string>(); // Global: tracks people already counted in width calculations
  
  // ─── FIXED: getWidth now uses global tracking to prevent double-counting ───
  // When a person is reachable through multiple paths (e.g., married-in spouse who is 
  // also a root, or shared children), their width is only counted ONCE.
  const getWidth = (id: string, vis = new Set<string>()): number => {
    // If already counted in another subtree, return 0 to avoid double-counting
    if (widthCounted.has(id)) return 0;
    if (vis.has(id)) return 0; // Cycle detection
    
    vis.add(id);
    widthCounted.add(id);
    
    const pid = partnerOf.get(id);
    // Mark partner as counted too (they'll be placed together)
    if (pid && !widthCounted.has(pid)) {
      widthCounted.add(pid);
    }
    
    const myKids  = childrenOf.get(id) || [];
    const pkids   = pid ? (childrenOf.get(pid) || []) : [];
    // Filter out children already counted in another subtree
    const allKids = [...new Set([...myKids, ...pkids])].filter(c => !widthCounted.has(c));
    
    const coupleW = NODE_WIDTH + (pid ? pGap(id, pid) + NODE_WIDTH : 0);
    let w: number;
    if (allKids.length === 0) {
      w = coupleW;
    } else {
      const childrenTotalW = allKids.reduce((sum, c) => sum + getWidth(c, new Set(vis)), 0)
                           + Math.max(0, allKids.length - 1) * SIBLING_GAP;
      w = Math.max(coupleW, childrenTotalW);
    }
    sw.set(id, w);
    return w;
  };

  const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
  roots.forEach(r => getWidth(r.id));

  const xPos     = new Map<string, number>();
  const assigned = new Set<string>();

  const placeAt = (id: string, left: number, vis = new Set<string>()): void => {
    if (assigned.has(id) || vis.has(id)) return;
    vis.add(id);
    assigned.add(id);

    const pid     = partnerOf.get(id);
    const myKids  = childrenOf.get(id) || [];
    const pkids   = pid ? (childrenOf.get(pid) || []) : [];
    const allKids = [...new Set([...myKids, ...pkids])];
    
    // Children we need to place vs children already placed elsewhere
    const kidsToPlace = allKids.filter(c => !assigned.has(c));
    const kidsAlreadyPlaced = allKids.filter(c => assigned.has(c) && xPos.has(c));

    // ─── CASE 1: No children to place, but children exist elsewhere ───
    // Center this person on their existing children (don't use cursor position)
    if (kidsToPlace.length === 0 && kidsAlreadyPlaced.length > 0) {
      const existingCenters = kidsAlreadyPlaced
        .map(c => xPos.get(c)!)
        .map(x => x + NODE_WIDTH / 2);
      const spanCenter = (Math.min(...existingCenters) + Math.max(...existingCenters)) / 2;
      
      if (pid && !assigned.has(pid)) {
        assigned.add(pid);
        vis.add(pid);
        const gap = pGap(id, pid);
        const coupleW = NODE_WIDTH * 2 + gap;
        xPos.set(id, spanCenter - coupleW / 2);
        xPos.set(pid, spanCenter - coupleW / 2 + NODE_WIDTH + gap);
      } else {
        xPos.set(id, spanCenter - NODE_WIDTH / 2);
      }
      return;
    }

    // ─── CASE 2: No children at all (leaf couple/person) ───
    if (kidsToPlace.length === 0) {
      xPos.set(id, left);
      if (pid && !assigned.has(pid)) {
        assigned.add(pid);
        vis.add(pid);
        xPos.set(pid, left + NODE_WIDTH + pGap(id, pid));
      }
      return;
    }

    // ─── CASE 3: Has children to place ───
    let cur = left;
    for (let i = 0; i < kidsToPlace.length; i++) {
      const kid = kidsToPlace[i];
      placeAt(kid, cur, new Set(vis));
      cur += sw.get(kid) ?? NODE_WIDTH;
      if (i < kidsToPlace.length - 1) {
        cur += SIBLING_GAP;
      }
    }

    // Center parent based on ALL children (both newly placed and already placed)
    const allChildCenters = allKids
      .filter(c => xPos.has(c))
      .map(c => xPos.get(c)! + NODE_WIDTH / 2);

    if (!allChildCenters.length) { xPos.set(id, left); return; }

    const spanCenter = (Math.min(...allChildCenters) + Math.max(...allChildCenters)) / 2;

    if (pid && !assigned.has(pid)) {
      assigned.add(pid);
      vis.add(pid);
      const gap     = pGap(id, pid);
      const coupleW = NODE_WIDTH * 2 + gap;
      xPos.set(id,  spanCenter - coupleW / 2);
      xPos.set(pid, spanCenter - coupleW / 2 + NODE_WIDTH + gap);
    } else {
      xPos.set(id, spanCenter - NODE_WIDTH / 2);
    }
  };

  // Track the rightmost position used, so we know where to start truly new families
  let rightmostX = 0;
  
  // First pass: place all roots (some will be positioned relative to existing family)
  for (const r of roots) {
    if (!assigned.has(r.id)) {
      placeAt(r.id, rightmostX + (rightmostX > 0 ? FAMILY_GROUP_GAP : 0));
    }
    // Update rightmost based on actual positions
    for (const [, x] of xPos) {
      rightmostX = Math.max(rightmostX, x + NODE_WIDTH);
    }
  }

  // Fallback for any unassigned people (isolated nodes)
  for (const p of people) {
    if (!assigned.has(p.id)) {
      xPos.set(p.id, rightmostX + FAMILY_GROUP_GAP);
      assigned.add(p.id);
      rightmostX += NODE_WIDTH + FAMILY_GROUP_GAP;
    }
  }

  // ─── Normalize: shift all positions so leftmost is at x=0 ───
  // (centering logic can create negative positions)
  const allXValues = Array.from(xPos.values());
  if (allXValues.length > 0) {
    const minX = Math.min(...allXValues);
    if (minX < 0) {
      for (const [id, x] of xPos) {
        xPos.set(id, x - minX);
      }
    }
  }

  const nodes: Node<Person>[] = people.map(p => ({
    id: p.id, type: 'timelinePerson',
    position: { x: xPos.get(p.id) ?? 0, y: ((generations.get(p.id) ?? 1) - 1) * ROW_HEIGHT },
    data: p, draggable: false, width: NODE_WIDTH,
  }));

  const validIds = new Set(people.map(p => p.id));
  const edges: Edge[] = relationships
    .filter(r => validIds.has(r.personAId) && validIds.has(r.personBId))
    .map(rel => buildEdgeFromPositions(rel, xPos, edgeType));

  const byGen = new Map<number, Person[]>();
  for (const p of people) {
    const g = generations.get(p.id) ?? 1;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }
  const axisInfo = Array.from(byGen.entries()).sort(([a], [b]) => a - b).map(([g, gp]) => {
    const ys = gp.map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null).filter((y): y is number => y !== null);
    const mn = ys.length ? Math.min(...ys) : null;
    const mx = ys.length ? Math.max(...ys) : null;
    const yr = mn && mx ? (mn === mx ? `${mn}` : `${mn}–${mx}`) : '';
    return { gen: g, y: (g - 1) * ROW_HEIGHT, yearRange: yr };
  });

  const allX = Array.from(xPos.values());
  const totalWidth = allX.length ? Math.max(...allX) + NODE_WIDTH + 60 : 1000;
  return { nodes, edges, axisInfo, totalWidth };
};


const GenerationAxis = memo(({ axisInfo, rowHeight }: {
  axisInfo: { gen: number; y: number; yearRange: string }[];
  rowHeight: number;
}) => {
  const transform    = useStore(s => s.transform);
  const viewportY    = transform[1];
  const viewportZoom = transform[2];
  return (
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden pointer-events-none">
      <div className="relative w-full" style={{ transform: `translateY(${viewportY}px)`, height: '10000px' }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => (
          <div key={gen}
            style={{ top: `${y * viewportZoom}px`, height: `${rowHeight * viewportZoom}px` }}
            className="absolute right-0 left-0 flex flex-col items-center justify-center px-1 border-b border-border/20 text-center"
          >
            <span className="text-sm font-bold text-foreground leading-none">דור {gen}</span>
            {yearRange && <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">{yearRange}</span>}
          </div>
        ))}
      </div>
    </div>
  );
});
GenerationAxis.displayName = 'GenerationAxis';

const HorizontalScrollbar = ({ totalWidth, leftOffset = 80 }: { totalWidth: number; leftOffset?: number }) => {
  const { setViewport, getViewport } = useReactFlow();
  const transform = useStore(s => s.transform);
  const trackRef  = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const dragging  = useRef(false);
  const dragData  = useRef({ mouseX: 0, vpX: 0 });

  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setTrackW(e.contentRect.width);
    });
    ro.observe(el); setTrackW(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const vpX    = transform[0];
  const vpZoom = transform[2];

  if (trackW === 0) {
    return <div ref={trackRef} className="absolute bottom-3 z-20" style={{ left: leftOffset + 12, right: 12, height: 10 }} />;
  }

  const visibleW   = trackW / vpZoom;
  const contentW   = Math.max(totalWidth, visibleW + 1);
  const thumbPct   = Math.min(0.98, visibleW / contentW);
  const thumbW     = Math.max(48, thumbPct * trackW);
  const range      = Math.max(1, trackW - thumbW);
  const worldRange = Math.max(1, contentW - visibleW);
  const scrollPct  = Math.min(1, Math.max(0, -vpX / vpZoom / worldRange));
  const thumbLeft  = scrollPct * range;

  if (thumbPct >= 0.98) return null;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || dragging.current) return;
    const rect   = trackRef.current.getBoundingClientRect();
    const newPct = Math.max(0, Math.min(1, (e.clientX - rect.left - thumbW / 2) / range));
    setViewport({ x: -(newPct * worldRange * vpZoom), y: getViewport().y, zoom: vpZoom }, { duration: 200 });
  };

  const handleThumbDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true;
    dragData.current = { mouseX: e.clientX, vpX };
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dx     = me.clientX - dragData.current.mouseX;
      const newVpX = Math.min(0, Math.max(-(worldRange * vpZoom), dragData.current.vpX - (dx / range) * worldRange * vpZoom));
      setViewport({ x: newVpX, y: getViewport().y, zoom: vpZoom });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={trackRef} className="absolute bottom-3 z-20 h-2.5 rounded-full bg-border/40 cursor-pointer select-none"
      style={{ left: leftOffset + 12, right: 12 }} onClick={handleTrackClick}>
      <div className="absolute top-0 h-full rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/70 transition-colors cursor-grab active:cursor-grabbing"
        style={{ left: thumbLeft, width: thumbW }}
        onMouseDown={handleThumbDown} onClick={e => e.stopPropagation()} />
    </div>
  );
};

interface CtxMenu { x: number; y: number; personId: string; }

const TimelineContextMenu = ({ menu, onOpenCard, onClose }: {
  menu: CtxMenu; onOpenCard: (id: string) => void; onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[160px]"
      style={{ top: menu.y, left: menu.x }}>
      <button className="w-full text-right px-4 py-2 text-sm hover:bg-muted transition-colors"
        onClick={() => { onOpenCard(menu.personId); onClose(); }}>
        פתח כרטיס
      </button>
    </div>
  );
};

function TimelineViewContent({
  people, relationships, edgeType, isCompact,
  onNodeDoubleClick, tree, onUpdateTree,
}: {
  people: Person[]; relationships: Relationship[]; edgeType: EdgeType;
  isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick;
  tree?: FamilyTree | null; onUpdateTree?: (d: Partial<FamilyTree>) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange]        = useState({ min: 1900, max: 2024 });
  const [axisInfo, setAxisInfo]          = useState<{ gen: number; y: number; yearRange: string }[]>([]);
  const [totalWidth, setTotalWidth]      = useState(2000);
  const [ownerOpen, setOwnerOpen]        = useState(false);
  const [ctxMenu, setCtxMenu]            = useState<CtxMenu | null>(null);
  const { setViewport, fitView }         = useReactFlow();
  const didFit = useRef(false);

  const visiblePeople        = useMemo(() => people,        [people]);
  const visibleRelationships = useMemo(() => relationships, [relationships]);

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
  }, [tree?.ownerPersonId, fitView]);

  const buildCompact = useCallback(() => {
    if (!visiblePeople.length) { setNodes([]); setEdges([]); setAxisInfo([]); return; }
    const gens = assignGenerations(visiblePeople, visibleRelationships, tree?.ownerPersonId);
    const { nodes: n, edges: e, axisInfo: a, totalWidth: tw } =
      buildCompactLayout(visiblePeople, visibleRelationships, gens, edgeType);
    setNodes(n); setEdges(e); setAxisInfo(a); setTotalWidth(tw);
  }, [visiblePeople, visibleRelationships, edgeType, tree?.ownerPersonId, setNodes, setEdges]);

  const buildYearBased = useCallback(() => {
    if (!visiblePeople.length) { setNodes([]); setEdges([]); return; }
    const gens = assignGenerations(visiblePeople, visibleRelationships, tree?.ownerPersonId);
    const withData = visiblePeople.map(p => {
      const d = p.birthDate ? parseISO(p.birthDate) : null;
      return { ...p, birthYear: d && isValid(d) ? getYear(d) : null, generation: gens.get(p.id) || 0 };
    }).filter(p => p.generation > 0);

    const bys = withData.map(p => p.birthYear).filter((y): y is number => y !== null);
    const minY = bys.length ? Math.min(...bys) - 5 : new Date().getFullYear() - 50;
    const maxY = bys.length ? Math.max(...bys, new Date().getFullYear()) + 5 : new Date().getFullYear();
    setYearRange({ min: minY, max: maxY });

    const byG = new Map<number, typeof withData>();
    for (const p of withData) {
      if (!byG.has(p.generation)) byG.set(p.generation, []);
      byG.get(p.generation)!.push(p);
    }

    const newNodes: Node<Person>[] = [];
    const lastY = new Map<number, number>();
    for (const g of Array.from(byG.keys()).sort((a, b) => a - b)) {
      if (!g) continue;
      const gp = (byG.get(g) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
      const x = 100 + (g - 1) * COLUMN_WIDTH;
      lastY.set(g, -Infinity);
      for (const p of gp) {
        const ideal = p.birthYear !== null
          ? (p.birthYear - minY) * PIXELS_PER_YEAR
          : lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP;
        const y = Math.max(ideal, lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP);
        newNodes.push({ id: p.id, type: 'timelinePerson', position: { x, y }, data: p });
        lastY.set(g, y);
      }
    }

    const hadNone = nodes.length === 0;
    setNodes(newNodes);
    setEdges(visibleRelationships.map(r => ({
      id: r.id, source: r.personAId, target: r.personBId, type: edgeType,
      animated: PARENT_REL_TYPES.includes(r.relationshipType),
      className: 'custom-edge',
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
    })));
    if (hadNone && newNodes.length)
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePeople, visibleRelationships, edgeType, tree?.ownerPersonId, setNodes, setEdges, setViewport]);

  useEffect(() => {
    didFit.current = false;
    if (isCompact) {
      buildCompact();
      setTimeout(() => {
        if (!didFit.current) {
          didFit.current = true;
          if (tree?.ownerPersonId) {
            fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
          } else {
            fitView({ padding: 0.12, duration: 500 });
          }
        }
      }, 200);
    } else {
      buildYearBased();
    }
  }, [isCompact, buildCompact, buildYearBased, fitView, tree?.ownerPersonId]);

  const handleCtxMenu = useCallback((e: React.MouseEvent, node: Node<Person>) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, personId: node.id });
  }, []);

  const handleOpenCard = useCallback((id: string) => {
    const person = people.find(p => p.id === id);
    if (person && onNodeDoubleClick)
      onNodeDoubleClick(new MouseEvent('dblclick') as any, { id, data: person } as Node<Person>);
  }, [people, onNodeDoubleClick]);

  return (
    <div className="h-full w-full relative bg-background" onClick={() => setCtxMenu(null)}>
      {isCompact  && <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />}
      {!isCompact && <TimelineAxis minYear={yearRange.min} maxYear={yearRange.max} pixelsPerYear={PIXELS_PER_YEAR} />}

      {isCompact && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={centerOnOwner} disabled={!tree?.ownerPersonId}>
                <LocateFixed className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>מרכז עליי</p></TooltipContent>
          </Tooltip>
          <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><User className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <h4 className="text-sm font-medium p-2 border-b text-center">מי אתה בעץ?</h4>
              <ScrollArea className="h-72">
                <div className="p-2 space-y-1">
                  {people.map(person => (
                    <Button key={person.id}
                      variant={tree?.ownerPersonId === person.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        onUpdateTree?.({ ownerPersonId: person.id });
                        setOwnerOpen(false);
                        setTimeout(() => fitView({ nodes: [{ id: person.id }], duration: 600, padding: 0.5 }), 100);
                      }}>
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
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={handleCtxMenu}
        nodeTypes={nodeTypes}
        fitView={false}
        className="ml-20"
        panOnDrag zoomOnScroll
        minZoom={0.05} maxZoom={4}
        nodesDraggable={false} nodesConnectable={false}
        defaultEdgeOptions={{ className: 'custom-edge', style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>

      {isCompact && <HorizontalScrollbar totalWidth={totalWidth} leftOffset={80} />}

      {ctxMenu && (
        <TimelineContextMenu menu={ctxMenu} onOpenCard={handleOpenCard} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}

export function TimelineView(props: {
  people: Person[]; relationships: Relationship[]; edgeType: EdgeType;
  isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick;
  tree?: FamilyTree | null; onUpdateTree?: (d: Partial<FamilyTree>) => void;
}) {
  return <ReactFlowProvider><TimelineViewContent {...props} /></ReactFlowProvider>;
}