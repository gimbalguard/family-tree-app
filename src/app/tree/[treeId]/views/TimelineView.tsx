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
import { layoutFromMap } from 'entitree-flex';

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
const PIXELS_PER_YEAR     = 80;
const NODE_HEIGHT_DEFAULT = 120;
const MIN_VERTICAL_GAP    = 16;
const COLUMN_WIDTH        = 300;

const NODE_WIDTH          = 160;
const NODE_HEIGHT         = 140;
const SIBLING_SPACING     = 20;   // gap between siblings
const SPOUSE_SPACING      = 16;   // gap between spouses
const GENERATION_SPACING  = 80;   // vertical gap between generations (entitree adds to node height)

const PARENT_REL_TYPES    = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES   = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES   = ['sibling', 'twin', 'half_sibling', 'step_sibling'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Generation Assignment — BFS ──────────────────────────────────────────────
// Used only for the axis labels — entitree-flex handles the actual positions.
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  ownerId?: string
): Map<string, number> => {
  const gen = new Map<string, number>();
  const parentsOf  = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, string[]>();
  const siblingsOf = new Map<string, string[]>();

  for (const p of people) {
    parentsOf.set(p.id, []); childrenOf.set(p.id, []);
    partnersOf.set(p.id, []); siblingsOf.set(p.id, []);
  }
  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnersOf.get(rel.personAId)?.push(rel.personBId);
      partnersOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (SIBLING_REL_TYPES.includes(rel.relationshipType)) {
      siblingsOf.get(rel.personAId)?.push(rel.personBId);
      siblingsOf.get(rel.personBId)?.push(rel.personAId);
    }
  }

  const assignCluster = (startId: string, g: number, queue: { id: string; g: number }[]) => {
    if (gen.has(startId)) return;
    gen.set(startId, g);
    const clQ = [startId]; const clV = new Set([startId]);
    while (clQ.length) {
      const cId = clQ.shift()!;
      for (const pid of (partnersOf.get(cId) || [])) {
        if (!gen.has(pid) && !clV.has(pid)) {
          clV.add(pid); clQ.push(pid); gen.set(pid, g);
          for (const pp of (parentsOf.get(pid) || [])) if (!gen.has(pp)) queue.push({ id: pp, g: g - 1 });
          for (const pc of (childrenOf.get(pid) || [])) if (!gen.has(pc)) queue.push({ id: pc, g: g + 1 });
          for (const ps of (siblingsOf.get(pid) || [])) if (!gen.has(ps)) queue.push({ id: ps, g });
        }
      }
    }
  };

  const bfsFrom = (startId: string, startGen: number) => {
    if (gen.has(startId)) return;
    const queue: { id: string; g: number }[] = [{ id: startId, g: startGen }];
    while (queue.length) {
      const { id, g } = queue.shift()!;
      if (gen.has(id)) continue;
      assignCluster(id, g, queue);
      for (const pp of (parentsOf.get(id) || [])) if (!gen.has(pp)) queue.push({ id: pp, g: g - 1 });
      for (const pc of (childrenOf.get(id) || [])) if (!gen.has(pc)) queue.push({ id: pc, g: g + 1 });
      for (const ps of (siblingsOf.get(id) || [])) if (!gen.has(ps)) queue.push({ id: ps, g });
    }
  };

  let anchorId: string | undefined;
  if (ownerId && people.some(p => p.id === ownerId)) anchorId = ownerId;
  else {
    const chainLen = (id: string, vis = new Set<string>()): number => {
      if (vis.has(id)) return 0; vis.add(id);
      const ch = childrenOf.get(id) || [];
      return ch.length ? 1 + Math.max(...ch.map(c => chainLen(c, new Set(vis)))) : 1;
    };
    const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
    anchorId = roots.length ? roots.sort((a, b) => chainLen(b.id) - chainLen(a.id))[0].id : people[0]?.id;
  }

  if (anchorId) bfsFrom(anchorId, 0);
  for (const p of people) {
    if (!gen.has(p.id)) {
      const vis = new Set<string>(); let root = p.id;
      const findRoot = (id: string) => {
        if (vis.has(id)) return; vis.add(id);
        const pars = parentsOf.get(id) || [];
        if (!pars.length) { root = id; return; }
        pars.forEach(findRoot);
      };
      findRoot(p.id); bfsFrom(root, 0);
    }
  }
  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 0);
  const minG = Math.min(...Array.from(gen.values()));
  for (const [id, g] of gen) gen.set(id, g + (1 - minG));
  return gen;
};

// ─── Build layout using entitree-flex ─────────────────────────────────────────
//
// entitree-flex is the engine behind entitree.com — built specifically for
// family trees. It handles:
//   - Spouses as "side nodes" (always next to each other)
//   - Children centered under both parents
//   - Multiple marriages
//   - Ancestors and descendants simultaneously
//   - Variable node sizes
//
const buildEntitreeLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType
): {
  nodes: Node<Person>[];
  edges: Edge[];
  axisInfo: { gen: number; y: number; yearRange: string }[];
  totalWidth: number;
} => {
  if (!people.length) return { nodes: [], edges: [], axisInfo: [], totalWidth: 0 };

  // ── Build adjacency maps ──
  const childrenOf = new Map<string, string[]>();
  const parentsOf  = new Map<string, string[]>();
  const spousesOf  = new Map<string, string[]>();

  for (const p of people) {
    childrenOf.set(p.id, []);
    parentsOf.set(p.id, []);
    spousesOf.set(p.id, []);
  }

  for (const rel of relationships) {
    if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      if (!spousesOf.get(rel.personAId)?.includes(rel.personBId)) {
        spousesOf.get(rel.personAId)?.push(rel.personBId);
      }
      if (!spousesOf.get(rel.personBId)?.includes(rel.personAId)) {
        spousesOf.get(rel.personBId)?.push(rel.personAId);
      }
    }
  }

  // ── Build entitree-flex input map ──
  // Each person gets: children[], parents[], spouses[], width, height
  const treeMap: Record<string, {
    id: string;
    children: string[];
    parents: string[];
    spouses: string[];
    width: number;
    height: number;
  }> = {};

  for (const p of people) {
    treeMap[p.id] = {
      id: p.id,
      children: childrenOf.get(p.id) || [],
      parents:  parentsOf.get(p.id)  || [],
      spouses:  spousesOf.get(p.id)  || [],
      width:    NODE_WIDTH,
      height:   NODE_HEIGHT,
    };
  }

  // ── Find the root (anchor person) ──
  // Use the person with the most ancestors+descendants, centered in the tree
  const getScore = (id: string): number => {
    const anc = (parentsOf.get(id) || []).length;
    const desc = (childrenOf.get(id) || []).length;
    return anc + desc;
  };
  const rootId = people.reduce((best, p) =>
    getScore(p.id) > getScore(best.id) ? p : best, people[0]).id;

  // ── Run entitree-flex layout ──
  let layoutResult: ReturnType<typeof layoutFromMap>;
  try {
    layoutResult = layoutFromMap(rootId, treeMap, {
      enableFlex:          true,
      firstDegreeSpacing:  SIBLING_SPACING,
      nextAfterSpacing:    SPOUSE_SPACING,
      nextBeforeSpacing:   SPOUSE_SPACING,
      nodeWidth:           NODE_WIDTH,
      nodeHeight:          NODE_HEIGHT,
      orientation:         'vertical',   // parents above, children below
    });
  } catch (e) {
    console.error('entitree-flex layout error:', e);
    // Fallback: simple grid layout
    const fallbackNodes: Node<Person>[] = people.map((p, i) => ({
      id: p.id, type: 'timelinePerson',
      position: { x: i * (NODE_WIDTH + 20), y: ((generations.get(p.id) ?? 1) - 1) * (NODE_HEIGHT + GENERATION_SPACING) },
      data: p, draggable: false,
    }));
    return { nodes: fallbackNodes, edges: [], axisInfo: [], totalWidth: people.length * (NODE_WIDTH + 20) };
  }

  // ── Map entitree positions to React Flow nodes ──
  // entitree uses rootX/rootY as the center of the root node.
  // We need to normalize so all positions are positive.
  const posMap = new Map<string, { x: number; y: number }>();

  for (const [id, nodeData] of Object.entries(layoutResult.map)) {
    if (nodeData && typeof nodeData.x === 'number' && typeof nodeData.y === 'number') {
      posMap.set(id, { x: nodeData.x, y: nodeData.y });
    }
  }

  // Normalize: shift all positions so minimum x=20, minimum y=20
  const allX = Array.from(posMap.values()).map(p => p.x);
  const allY = Array.from(posMap.values()).map(p => p.y);
  const minX = allX.length ? Math.min(...allX) : 0;
  const minY = allY.length ? Math.min(...allY) : 0;

  // For people not placed by entitree (disconnected components),
  // use generation-based fallback positioned to the right
  const maxX = allX.length ? Math.max(...allX) : 0;
  let fallbackCursor = maxX + NODE_WIDTH + 40;

  const nodes: Node<Person>[] = people.map(p => {
    let pos = posMap.get(p.id);
    if (!pos) {
      // Not placed by entitree — place at right edge at correct generation row
      const g = generations.get(p.id) ?? 1;
      pos = { x: fallbackCursor, y: (g - 1) * (NODE_HEIGHT + GENERATION_SPACING) };
      fallbackCursor += NODE_WIDTH + 20;
    }
    return {
      id: p.id,
      type: 'timelinePerson',
      position: {
        x: pos.x - minX + 20,
        y: pos.y - minY + 20,
      },
      data: p,
      draggable: false,
      width: NODE_WIDTH,
    };
  });

  // ── Build edges using actual node positions ──
  const nodeXMap = new Map(nodes.map(n => [n.id, n.position.x]));
  const validIds = new Set(people.map(p => p.id));

  const edges: Edge[] = relationships
    .filter(r => validIds.has(r.personAId) && validIds.has(r.personBId))
    .map(rel => {
      let sh: string, th: string;
      if (PARENT_REL_TYPES.includes(rel.relationshipType)) {
        sh = 'bottom'; th = 'top';
      } else {
        const aX = nodeXMap.get(rel.personAId) ?? 0;
        const bX = nodeXMap.get(rel.personBId) ?? 0;
        const aIsLeft = (aX + NODE_WIDTH / 2) <= (bX + NODE_WIDTH / 2);
        sh = aIsLeft ? 'right' : 'left';
        th = aIsLeft ? 'left'  : 'right';
      }
      return {
        id: rel.id,
        source: rel.personAId, sourceHandle: sh,
        target: rel.personBId, targetHandle: th,
        type: edgeType,
        className: 'custom-edge',
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
      };
    });

  // ── Axis info — derive generation Y positions from actual node positions ──
  // Group people by generation, find median Y for each generation band
  const byGen = new Map<number, number[]>(); // gen → [y positions]
  for (const node of nodes) {
    const g = generations.get(node.id) ?? 1;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(node.position.y);
  }

  const allGenPeople = new Map<number, Person[]>();
  for (const p of people) {
    const g = generations.get(p.id) ?? 1;
    if (!allGenPeople.has(g)) allGenPeople.set(g, []);
    allGenPeople.get(g)!.push(p);
  }

  const axisInfo = Array.from(byGen.entries())
    .sort(([a], [b]) => a - b)
    .map(([g, ys]) => {
      const minY = Math.min(...ys);
      const gp = allGenPeople.get(g) || [];
      const birthYears = gp
        .map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null)
        .filter((y): y is number => y !== null);
      const mn = birthYears.length ? Math.min(...birthYears) : null;
      const mx = birthYears.length ? Math.max(...birthYears) : null;
      const yr = mn && mx ? (mn === mx ? `${mn}` : `${mn}–${mx}`) : '';
      return { gen: g, y: minY, yearRange: yr };
    });

  const finalMaxX = Math.max(...nodes.map(n => n.position.x)) + NODE_WIDTH + 40;

  return { nodes, edges, axisInfo, totalWidth: finalMaxX };
};

// ─── Generation Axis ──────────────────────────────────────────────────────────
// Adapted to work with entitree's variable Y positions (not fixed row heights)
const GenerationAxis = memo(({ axisInfo, nodeHeight }: {
  axisInfo: { gen: number; y: number; yearRange: string }[];
  nodeHeight: number;
}) => {
  const transform = useStore(s => s.transform);
  const [vy, vz] = [transform[1], transform[2]];

  // Compute height for each band: distance to next band's Y, or fixed fallback
  const sorted = [...axisInfo].sort((a, b) => a.gen - b.gen);

  return (
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden pointer-events-none">
      <div className="relative w-full" style={{ transform: `translateY(${vy}px)`, height: '100000px' }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {sorted.map((item, i) => {
          const nextY = sorted[i + 1]?.y ?? (item.y + nodeHeight + 60);
          const bandH = nextY - item.y;
          return (
            <div key={item.gen}
              style={{ top: `${item.y * vz}px`, height: `${bandH * vz}px` }}
              className="absolute right-0 left-0 flex flex-col items-center justify-center px-1 border-b border-border/20 text-center"
            >
              <span className="text-sm font-bold text-foreground leading-none">דור {item.gen}</span>
              {item.yearRange && <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">{item.yearRange}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
GenerationAxis.displayName = 'GenerationAxis';

// ─── Horizontal Scrollbar ─────────────────────────────────────────────────────
const HorizontalScrollbar = ({ totalWidth, leftOffset = 80 }: { totalWidth: number; leftOffset?: number }) => {
  const { setViewport, getViewport } = useReactFlow();
  const transform = useStore(s => s.transform);
  const trackRef  = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(600);
  const dragging  = useRef(false);
  const dragData  = useRef({ mouseX: 0, vpX: 0 });

  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setTrackW(e.contentRect.width); });
    ro.observe(el); setTrackW(el.offsetWidth); return () => ro.disconnect();
  }, []);

  const vpX = transform[0], vpZoom = transform[2];
  const visibleW   = trackW / vpZoom;
  const contentW   = Math.max(totalWidth, visibleW + 1);
  const thumbPct   = Math.min(0.98, visibleW / contentW);
  const thumbW     = Math.max(48, thumbPct * trackW);
  const range      = Math.max(1, trackW - thumbW);
  const worldRange = Math.max(1, contentW - visibleW);
  const pct        = Math.min(1, Math.max(0, -vpX / vpZoom / worldRange));
  const thumbLeft  = pct * range;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || dragging.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const newPct = Math.max(0, Math.min(1, (e.clientX - rect.left - thumbW / 2) / range));
    setViewport({ x: -(newPct * worldRange * vpZoom), y: getViewport().y, zoom: vpZoom }, { duration: 200 });
  };
  const handleThumbDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true; dragData.current = { mouseX: e.clientX, vpX };
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dx = me.clientX - dragData.current.mouseX;
      const newVpX = Math.min(0, Math.max(-(worldRange * vpZoom), dragData.current.vpX - (dx / range) * worldRange * vpZoom));
      setViewport({ x: newVpX, y: getViewport().y, zoom: vpZoom });
    };
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  if (thumbPct >= 0.98) return null;
  return (
    <div ref={trackRef} className="absolute bottom-3 z-20 h-2.5 rounded-full bg-border/40 cursor-pointer select-none"
      style={{ left: leftOffset + 12, right: 12 }} onClick={handleTrackClick}>
      <div className="absolute top-0 h-full rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/70 transition-colors cursor-grab active:cursor-grabbing"
        style={{ left: thumbLeft, width: thumbW }}
        onMouseDown={handleThumbDown} onClick={e => e.stopPropagation()} />
    </div>
  );
};

// ─── Context Menu ─────────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; personId: string; }
const TimelineContextMenu = ({ menu, onOpenCard, onClose }: {
  menu: CtxMenu; onOpenCard: (id: string) => void; onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[160px]"
      style={{ top: menu.y, left: menu.x }}>
      <button className="w-full text-right px-4 py-2 text-sm hover:bg-muted transition-colors"
        onClick={() => { onOpenCard(menu.personId); onClose(); }}>פתח כרטיס</button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
function TimelineViewContent({
  people, relationships, edgeType, isCompact, onNodeDoubleClick, tree, onUpdateTree,
}: {
  people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick; tree?: FamilyTree | null; onUpdateTree?: (d: Partial<FamilyTree>) => void;
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

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
  }, [tree?.ownerPersonId, fitView]);

  const buildCompact = useCallback(() => {
    if (!people.length) { setNodes([]); setEdges([]); setAxisInfo([]); return; }
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    const { nodes: n, edges: e, axisInfo: a, totalWidth: tw } =
      buildEntitreeLayout(people, relationships, gens, edgeType);
    setNodes(n); setEdges(e); setAxisInfo(a); setTotalWidth(tw);
  }, [people, relationships, edgeType, tree?.ownerPersonId, setNodes, setEdges]);

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
    for (const p of withData) { if (!byG.has(p.generation)) byG.set(p.generation, []); byG.get(p.generation)!.push(p); }
    const newNodes: Node<Person>[] = []; const lastY = new Map<number, number>();
    for (const g of Array.from(byG.keys()).sort((a, b) => a - b)) {
      if (!g) continue;
      const gp = (byG.get(g) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
      const x = 100 + (g - 1) * COLUMN_WIDTH; lastY.set(g, -Infinity);
      for (const p of gp) {
        const ideal = p.birthYear !== null ? (p.birthYear - minY) * PIXELS_PER_YEAR : lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP;
        const y = Math.max(ideal, lastY.get(g)! + NODE_HEIGHT_DEFAULT + MIN_VERTICAL_GAP);
        newNodes.push({ id: p.id, type: 'timelinePerson', position: { x, y }, data: p }); lastY.set(g, y);
      }
    }
    const hadNone = nodes.length === 0;
    setNodes(newNodes);
    setEdges(relationships.map(r => ({
      id: r.id, source: r.personAId, target: r.personBId, type: edgeType,
      animated: PARENT_REL_TYPES.includes(r.relationshipType), className: 'custom-edge',
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
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
          if (tree?.ownerPersonId) fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
          else fitView({ padding: 0.1, duration: 500 });
        }
      }, 250);
    } else { buildYearBased(); }
  }, [isCompact, buildCompact, buildYearBased, fitView, tree?.ownerPersonId]);

  const handleCtxMenu = useCallback((e: React.MouseEvent, node: Node<Person>) => {
    e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, personId: node.id });
  }, []);
  const handleOpenCard = useCallback((id: string) => {
    const person = people.find(p => p.id === id);
    if (person && onNodeDoubleClick)
      onNodeDoubleClick(new MouseEvent('dblclick') as any, { id, data: person } as Node<Person>);
  }, [people, onNodeDoubleClick]);

  return (
    <div className="h-full w-full relative bg-background" onClick={() => setCtxMenu(null)}>
      {isCompact  && <GenerationAxis axisInfo={axisInfo} nodeHeight={NODE_HEIGHT} />}
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
              <ScrollArea className="h-72"><div className="p-2 space-y-1">
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
              </div></ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={handleCtxMenu}
        nodeTypes={nodeTypes} fitView={false} className="ml-20"
        panOnDrag zoomOnScroll minZoom={0.03} maxZoom={4}
        nodesDraggable={false} nodesConnectable={false}
        defaultEdgeOptions={{ className: 'custom-edge', style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>

      {isCompact && <HorizontalScrollbar totalWidth={totalWidth} leftOffset={80} />}
      {ctxMenu && <TimelineContextMenu menu={ctxMenu} onOpenCard={handleOpenCard} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}

export function TimelineView(props: {
  people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean;
  onNodeDoubleClick?: OnNodeDoubleClick; tree?: FamilyTree | null; onUpdateTree?: (d: Partial<FamilyTree>) => void;
}) {
  return <ReactFlowProvider><TimelineViewContent {...props} /></ReactFlowProvider>;
}