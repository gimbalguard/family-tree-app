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
const PIXELS_PER_YEAR   = 80;
const NODE_HEIGHT_DEFAULT = 120;
const MIN_VERTICAL_GAP  = 16;
const COLUMN_WIDTH      = 300;

const NODE_WIDTH        = 160;  // must match card width in TimelinePersonNode
const ROW_HEIGHT        = 180;  // vertical distance between generation rows
const SPOUSE_GAP        = 16;   // gap between married/partner cards
const SEPARATED_GAP     = 32;   // gap for ex/separated couples
const SIBLING_GAP       = 40;   // gap between sibling cards in same row
const FAMILY_GROUP_GAP  = 60;   // gap between unrelated family groups

const PARENT_REL_TYPES    = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES   = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES   = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Generation Assignment ─────────────────────────────────────────────────────
//
// Owner is the anchor (seeded at an internal value of 100).
// We propagate in BOTH directions:
//
//   DOWNWARD (parent → child):  child gen  = parent gen + 1
//   UPWARD   (child → parent):  parent gen = child gen  - 1
//
// This ensures a maternal grandfather with only 2 generations in the tree
// ends up on the SAME row as a paternal grandfather with 4 generations,
// because both derive their row from their child's generation, not from
// "I have no parents so I default to gen 1".
//
// After propagation we normalize so minimum generation = 1.
//
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  ownerId?: string
): Map<string, number> => {
  const gen = new Map<string, number>();

  // Build adjacency
  const parentsOf  = new Map<string, string[]>(); // personId → [parentIds]
  const childrenOf = new Map<string, string[]>(); // personId → [childIds]
  const partnersOf = new Map<string, string[]>(); // personId → [partnerIds]

  for (const p of people) {
    parentsOf.set(p.id, []);
    childrenOf.set(p.id, []);
    partnersOf.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      // personAId = parent, personBId = child
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnersOf.get(rel.personAId)?.push(rel.personBId);
      partnersOf.get(rel.personBId)?.push(rel.personAId);
    }
  }

  // Seed the owner, or fall back to the root of the longest bloodline
  if (ownerId && people.some(p => p.id === ownerId)) {
    gen.set(ownerId, 100);
  } else {
    const chainLen = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const ch = childrenOf.get(id) || [];
      if (!ch.length) return 1;
      return 1 + Math.max(...ch.map(c => chainLen(c, new Set(visited))));
    };
    const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
    if (roots.length) {
      const best = roots.sort((a, b) => chainLen(b.id) - chainLen(a.id))[0];
      gen.set(best.id, 1);
    }
  }

  // Bidirectional iterative propagation
  const MAX = people.length * 6 + 30;
  let changed = true, iter = 0;

  while (changed && iter++ < MAX) {
    changed = false;

    for (const p of people) {
      const cur = gen.get(p.id);

      // 1. Downward: parent gen + 1  (always re-evaluated — parents win)
      const pg = (parentsOf.get(p.id) || [])
        .map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (pg.length) {
        const want = Math.max(...pg) + 1;
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }

      // 2. Upward: child gen - 1  (fills ancestors without parents in tree)
      const cg = (childrenOf.get(p.id) || [])
        .map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (cg.length) {
        const want = Math.min(...cg) - 1;
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }

      if (cur !== undefined) continue; // already assigned by parent/child

      // 3. Partner: same gen as spouse
      const partnerG = (partnersOf.get(p.id) || [])
        .map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (partnerG.length) {
        const want = Math.max(...partnerG);
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }

      // 4. Sibling
      const sibIds = relationships
        .filter(r => SIBLING_REL_TYPES.includes(r.relationshipType) &&
          (r.personAId === p.id || r.personBId === p.id))
        .map(r => r.personAId === p.id ? r.personBId : r.personAId);
      const sibG = sibIds.map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (sibG.length) {
        const want = Math.max(...sibG);
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }
    }

    // 5. Isolated fallback — only if no context reachable
    for (const p of people) {
      if (!gen.has(p.id)) {
        const hasCtx =
          (partnersOf.get(p.id) || []).some(id => gen.has(id)) ||
          (childrenOf.get(p.id) || []).some(id => gen.has(id));
        if (!hasCtx) { gen.set(p.id, 1); changed = true; }
      }
    }
  }

  // Safety net
  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 1);

  // Normalize so minimum = 1
  const vals = Array.from(gen.values());
  const minG = Math.min(...vals);
  if (minG !== 1) {
    const shift = 1 - minG;
    for (const [id, g] of gen) gen.set(id, g + shift);
  }

  return gen;
};

// ─── Edge handle routing ──────────────────────────────────────────────────────
// Matches handle IDs defined in TimelinePersonNode:
//   top    = target  (receives from parents)
//   bottom = source  (sends to children)
//   left   = source + left-t = target
//   right  = source + right-t = target
//
// Parent → child:  source=bottom, target=top
// A is left of B:  source=right,  target=left-t
// A is right of B: source=left,   target=right-t
//
const getEdgeProps = (
  rel: Relationship,
  positions: Map<string, { x: number; y: number }>
) => {
  if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
    return {
      source: rel.personAId, sourceHandle: 'bottom',
      target: rel.personBId, targetHandle: 'top',
    };
  }

  const ax = positions.get(rel.personAId)?.x ?? 0;
  const bx = positions.get(rel.personBId)?.x ?? 0;
  const aIsLeft = ax <= bx;

  return {
    source: rel.personAId, sourceHandle: aIsLeft ? 'right'  : 'left',
    target: rel.personBId, targetHandle: aIsLeft ? 'left-t' : 'right-t',
  };
};

// ─── Layout algorithm ─────────────────────────────────────────────────────────
// 1. Compute subtree width for each person (recursive).
// 2. Walk roots left→right, assigning X by placing children first then
//    centering parents above them.
// 3. Y = (generation - 1) × ROW_HEIGHT.
//
const buildCompactLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType
) => {
  // ── Adjacency ──
  const parentsOf  = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnerOf  = new Map<string, string>(); // primary partner only
  const gapOf      = new Map<string, number>(); // keyed by sorted pair

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
        const gap = SEPARATED_REL_TYPES.includes(rel.relationshipType)
          ? SEPARATED_GAP : SPOUSE_GAP;
        gapOf.set([rel.personAId, rel.personBId].sort().join('|'), gap);
      }
    }
  }

  const pGap = (a: string, b: string) =>
    gapOf.get([a, b].sort().join('|')) ?? SPOUSE_GAP;

  // ── Subtree widths ──
  const sw = new Map<string, number>();

  const getWidth = (id: string, vis = new Set<string>()): number => {
    if (vis.has(id)) return NODE_WIDTH;
    if (sw.has(id))  return sw.get(id)!;
    vis.add(id);

    const pid = partnerOf.get(id);
    const myKids      = childrenOf.get(id) || [];
    const partnerKids = pid ? (childrenOf.get(pid) || []) : [];
    const allKids     = [...new Set([...myKids, ...partnerKids])].filter(c => !vis.has(c));

    const coupleW = NODE_WIDTH + (pid ? pGap(id, pid) + NODE_WIDTH : 0);
    const w = allKids.length === 0
      ? coupleW + FAMILY_GROUP_GAP
      : Math.max(coupleW + FAMILY_GROUP_GAP,
          allKids.reduce((s, c) => s + getWidth(c, new Set(vis)), 0));

    sw.set(id, w);
    return w;
  };

  const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
  roots.forEach(r => getWidth(r.id));

  // ── Assign X positions ──
  const xPos     = new Map<string, number>();
  const assigned = new Set<string>();

  const placeAt = (id: string, left: number, vis = new Set<string>()): void => {
    if (assigned.has(id) || vis.has(id)) return;
    vis.add(id); assigned.add(id);

    const pid     = partnerOf.get(id);
    const myKids  = childrenOf.get(id) || [];
    const pkids   = pid ? (childrenOf.get(pid) || []) : [];
    const allKids = [...new Set([...myKids, ...pkids])].filter(c => !assigned.has(c));

    if (!allKids.length) {
      // Leaf: place self then partner
      xPos.set(id, left);
      if (pid && !assigned.has(pid)) {
        assigned.add(pid); vis.add(pid);
        xPos.set(pid, left + NODE_WIDTH + pGap(id, pid));
      }
      return;
    }

    // Place children first
    let cur = left;
    for (const kid of allKids) {
      placeAt(kid, cur, new Set(vis));
      cur += sw.get(kid) ?? (NODE_WIDTH + FAMILY_GROUP_GAP);
    }

    // Center couple above children
    const xs = allKids.map(c => xPos.get(c)).filter((x): x is number => x !== undefined);
    if (!xs.length) { xPos.set(id, left); return; }

    const center = (Math.min(...xs) + Math.max(...xs)) / 2;

    if (pid && !assigned.has(pid)) {
      assigned.add(pid); vis.add(pid);
      const gap = pGap(id, pid);
      const tw  = NODE_WIDTH * 2 + gap;
      xPos.set(id,  center - tw / 2);
      xPos.set(pid, center - tw / 2 + NODE_WIDTH + gap);
    } else {
      xPos.set(id, center);
    }
  };

  let cursor = 0;
  for (const r of roots) {
    if (!assigned.has(r.id)) {
      placeAt(r.id, cursor);
      cursor += sw.get(r.id) ?? (NODE_WIDTH + FAMILY_GROUP_GAP);
    }
  }
  // Remaining disconnected
  for (const p of people) {
    if (!assigned.has(p.id)) {
      xPos.set(p.id, cursor);
      assigned.add(p.id);
      cursor += NODE_WIDTH + SIBLING_GAP;
    }
  }

  // ── Build nodes ──
  const positions = new Map<string, { x: number; y: number }>();
  const nodes: Node<Person>[] = people.map(p => {
    const g = generations.get(p.id) ?? 1;
    const x = xPos.get(p.id) ?? 0;
    const y = (g - 1) * ROW_HEIGHT;
    positions.set(p.id, { x, y });
    return { id: p.id, type: 'timelinePerson', position: { x, y }, data: p, draggable: false };
  });

  // ── Build edges ──
  const edges: Edge[] = relationships
    .filter(r => people.some(p => p.id === r.personAId) && people.some(p => p.id === r.personBId))
    .map(rel => {
      const ep = getEdgeProps(rel, positions);
      return {
        id: rel.id,
        source: ep.source, sourceHandle: ep.sourceHandle,
        target: ep.target, targetHandle: ep.targetHandle,
        type: edgeType,
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      };
    });

  // ── Axis info ──
  const byGen = new Map<number, Person[]>();
  for (const p of people) {
    const g = generations.get(p.id) ?? 1;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }
  const axisInfo = Array.from(byGen.entries())
    .sort(([a], [b]) => a - b)
    .map(([g, gp]) => {
      const ys = gp.map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null).filter((y): y is number => y !== null);
      const mn = ys.length ? Math.min(...ys) : null;
      const mx = ys.length ? Math.max(...ys) : null;
      const yr = mn && mx ? (mn === mx ? `${mn}` : `${mn}–${mx}`) : '';
      return { gen: g, y: (g - 1) * ROW_HEIGHT, yearRange: yr };
    });

  return { nodes, edges, axisInfo };
};

// ─── Generation Axis ──────────────────────────────────────────────────────────
const GenerationAxis = memo(({
  axisInfo, rowHeight,
}: {
  axisInfo: { gen: number; y: number; yearRange: string }[];
  rowHeight: number;
}) => {
  const transform   = useStore(s => s.transform);
  const viewportY   = transform[1];
  const viewportZoom = transform[2];

  return (
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden pointer-events-none">
      <div className="relative w-full" style={{ transform: `translateY(${viewportY}px)`, height: '10000px' }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => (
          <div
            key={gen}
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

// ─── Context Menu ─────────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const [ownerOpen, setOwnerOpen]        = useState(false);
  const [ctxMenu, setCtxMenu]            = useState<CtxMenu | null>(null);
  const { setViewport, fitView }         = useReactFlow();
  const didFit = useRef(false);

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
  }, [tree?.ownerPersonId, fitView]);

  // ── Compact mode ──
  const buildCompact = useCallback(() => {
    if (!people.length) { setNodes([]); setEdges([]); setAxisInfo([]); return; }
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    const { nodes: n, edges: e, axisInfo: a } = buildCompactLayout(people, relationships, gens, edgeType);
    setNodes(n); setEdges(e); setAxisInfo(a);
  }, [people, relationships, edgeType, tree?.ownerPersonId, setNodes, setEdges]);

  // ── Year-based mode (unchanged) ──
  const buildYearBased = useCallback(() => {
    if (!people.length) { setNodes([]); setEdges([]); return; }
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    const withData = people.map(p => {
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
      const x  = 100 + (g - 1) * COLUMN_WIDTH;
      lastY.set(g, -Infinity);
      for (const p of gp) {
        const ideal = p.birthYear !== null ? (p.birthYear - minY) * PIXELS_PER_YEAR : lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP;
        const y = Math.max(ideal, lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP);
        newNodes.push({ id: p.id, type: 'timelinePerson', position: { x, y }, data: p });
        lastY.set(g, y);
      }
    }
    const hadNone = nodes.length === 0;
    setNodes(newNodes);
    setEdges(relationships.map(r => ({
      id: r.id, source: r.personAId, target: r.personBId, type: edgeType,
      animated: PARENT_REL_TYPES.includes(r.relationshipType),
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })));
    if (hadNone && newNodes.length) setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, edgeType, tree?.ownerPersonId, setNodes, setEdges, setViewport]);

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
                    <Button key={person.id} variant={tree?.ownerPersonId === person.id ? 'default' : 'ghost'}
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
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 1.5 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>

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
