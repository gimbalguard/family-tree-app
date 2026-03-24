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
const PIXELS_PER_YEAR     = 80;
const NODE_HEIGHT_DEFAULT = 120;
const MIN_VERTICAL_GAP    = 16;
const COLUMN_WIDTH        = 300;

const NODE_WIDTH          = 160;
const ROW_HEIGHT          = 200;
const SPOUSE_GAP          = 20;
const SEPARATED_GAP       = 40;
const SIBLING_GAP         = 80;
const FAMILY_GROUP_GAP    = 100;

const PARENT_REL_TYPES    = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES   = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES   = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// ─── Edge handle routing ──────────────────────────────────────────────────────
const getEdgeProps = (rel: Relationship, nodes: Node<Person>[]) => {
  const nodeA = nodes.find(n => n.id === rel.personAId);
  const nodeB = nodes.find(n => n.id === rel.personBId);

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

  const aCenter = nodeA.position.x + (nodeA.width || NODE_WIDTH) / 2;
  const bCenter = nodeB.position.x + (nodeB.width || NODE_WIDTH) / 2;
  const aIsLeft = aCenter <= bCenter;

  return {
    source: rel.personAId,
    target: rel.personBId,
    sourceHandle: aIsLeft ? 'right' : 'left',
    targetHandle: aIsLeft ? 'left'  : 'right',
  };
};

// ─── Generation Assignment ─────────────────────────────────────────────────────
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  ownerId?: string
): Map<string, number> => {
  const gen = new Map<string, number>();

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
      childrenOf.get(rel.personAId)?.push(rel.personBId);
      parentsOf.get(rel.personBId)?.push(rel.personAId);
    }
    if (PARTNER_REL_TYPES.includes(rel.relationshipType)) {
      partnersOf.get(rel.personAId)?.push(rel.personBId);
      partnersOf.get(rel.personBId)?.push(rel.personAId);
    }
  }

  if (ownerId && people.some(p => p.id === ownerId)) {
    gen.set(ownerId, 100);
  } else {
    const chainLen = (id: string, vis = new Set<string>()): number => {
      if (vis.has(id)) return 0; vis.add(id);
      const ch = childrenOf.get(id) || [];
      return ch.length ? 1 + Math.max(...ch.map(c => chainLen(c, new Set(vis)))) : 1;
    };
    const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
    if (roots.length) gen.set(roots.sort((a, b) => chainLen(b.id) - chainLen(a.id))[0].id, 1);
  }

  let changed = true; let iter = 0;
  const MAX = people.length * 6 + 30;

  while (changed && iter++ < MAX) {
    changed = false;
    for (const p of people) {
      const cur = gen.get(p.id);
      const parentGens = (parentsOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (parentGens.length) {
        const want = Math.max(...parentGens) + 1;
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }
      const childGens = (childrenOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (childGens.length) {
        const want = Math.min(...childGens) - 1;
        if (want !== cur) { gen.set(p.id, want); changed = true; }
        continue;
      }
      if (cur !== undefined) continue;
      const partnerGens = (partnersOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (partnerGens.length) { gen.set(p.id, Math.max(...partnerGens)); changed = true; continue; }
      const sibIds = relationships.filter(r => SIBLING_REL_TYPES.includes(r.relationshipType) && (r.personAId === p.id || r.personBId === p.id)).map(r => r.personAId === p.id ? r.personBId : r.personAId);
      const sibGens = sibIds.map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (sibGens.length) { gen.set(p.id, Math.max(...sibGens)); changed = true; continue; }
    }
    for (const p of people) {
      if (!gen.has(p.id)) {
        const hasCtx = (partnersOf.get(p.id) || []).some(id => gen.has(id)) || (childrenOf.get(p.id) || []).some(id => gen.has(id));
        if (!hasCtx) { gen.set(p.id, 1); changed = true; }
      }
    }
  }

  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 1);
  const minG = Math.min(...Array.from(gen.values()));
  if (minG !== 1) { const s = 1 - minG; for (const [id, g] of gen) gen.set(id, g + s); }
  return gen;
};

// ─── Layout algorithm ─────────────────────────────────────────────────────────
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
  const getWidth = (id: string, vis = new Set<string>()): number => {
    if (vis.has(id)) return NODE_WIDTH;
    if (sw.has(id))  return sw.get(id)!;
    vis.add(id);
    const pid     = partnerOf.get(id);
    const myKids  = childrenOf.get(id) || [];
    const pkids   = pid ? (childrenOf.get(pid) || []) : [];
    const allKids = [...new Set([...myKids, ...pkids])].filter(c => !vis.has(c));
    const coupleW = NODE_WIDTH + (pid ? pGap(id, pid) + NODE_WIDTH : 0);
    const w = allKids.length === 0
      ? coupleW + FAMILY_GROUP_GAP
      : Math.max(coupleW + FAMILY_GROUP_GAP, allKids.reduce((s, c) => s + getWidth(c, new Set(vis)), 0));
    sw.set(id, w);
    return w;
  };

  const roots = people.filter(p => !(parentsOf.get(p.id) || []).length);
  roots.forEach(r => getWidth(r.id));

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
      xPos.set(id, left);
      if (pid && !assigned.has(pid)) {
        assigned.add(pid); vis.add(pid);
        xPos.set(pid, left + NODE_WIDTH + pGap(id, pid));
      }
      return;
    }

    let cur = left;
    for (const kid of allKids) {
      placeAt(kid, cur, new Set(vis));
      cur += sw.get(kid) ?? (NODE_WIDTH + FAMILY_GROUP_GAP);
    }
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
    if (!assigned.has(r.id)) { placeAt(r.id, cursor); cursor += sw.get(r.id) ?? (NODE_WIDTH + FAMILY_GROUP_GAP); }
  }
  for (const p of people) {
    if (!assigned.has(p.id)) { xPos.set(p.id, cursor); assigned.add(p.id); cursor += NODE_WIDTH + SIBLING_GAP; }
  }

  const nodes: Node<Person>[] = people.map(p => ({
    id: p.id, type: 'timelinePerson',
    position: { x: xPos.get(p.id) ?? 0, y: ((generations.get(p.id) ?? 1) - 1) * ROW_HEIGHT },
    data: p, draggable: false,
  }));
  const edges: Edge[] = relationships
    .filter(r => people.some(p => p.id === r.personAId) && people.some(p => p.id === r.personBId))
    .map(rel => {
      const { source, sourceHandle, target, targetHandle } = getEdgeProps(rel, nodes);
      return { id: rel.id, source, sourceHandle, target, targetHandle, type: edgeType, className: 'custom-edge', style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 }, };
    });
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

  return { nodes, edges, axisInfo };
};

// ─── Components ──────────────────────────────────────────────────────────
const GenerationAxis = memo(({ axisInfo, rowHeight }: { axisInfo: { gen: number; y: number; yearRange: string }[]; rowHeight: number; }) => {
  const transform = useStore(s => s.transform);
  const [viewportY, viewportZoom] = [transform[1], transform[2]];

  return (
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden pointer-events-none">
      <div className="relative w-full" style={{ transform: `translateY(${viewportY}px)`, height: `${(axisInfo[axisInfo.length - 1]?.y + rowHeight) * viewportZoom}px` }}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        {axisInfo.map(({ gen, y, yearRange }) => (
          <div key={gen} style={{ top: `${y * viewportZoom}px`, height: `${rowHeight * viewportZoom}px` }} className="absolute right-0 left-0 flex flex-col items-center justify-center px-1 border-b border-border/20 text-center">
            <span className="text-sm font-bold text-foreground leading-none">דור {gen}</span>
            {yearRange && <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">{yearRange}</span>}
          </div>
        ))}
      </div>
    </div>
  );
});
GenerationAxis.displayName = 'GenerationAxis';

interface CtxMenu { x: number; y: number; personId: string; }
const TimelineContextMenu = ({ menu, onOpenCard, onClose }: { menu: CtxMenu; onOpenCard: (id: string) => void; onClose: () => void; }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[160px]" style={{ top: menu.y, left: menu.x }}>
      <button className="w-full text-right px-4 py-2 text-sm hover:bg-muted transition-colors" onClick={() => { onOpenCard(menu.personId); onClose(); }}>פתח כרטיס</button>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────
function TimelineViewContent({ people, relationships, edgeType, isCompact, onNodeDoubleClick, tree, onUpdateTree }: {
  people: Person[]; relationships: Relationship[]; edgeType: EdgeType;
  isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick;
  tree?: FamilyTree | null; onUpdateTree?: (d: Partial<FamilyTree>) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const [axisInfo, setAxisInfo] = useState<{ gen: number; y: number; yearRange: string }[]>([]);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const { setViewport, fitView } = useReactFlow();
  const didFit = useRef(false);

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
  }, [tree?.ownerPersonId, fitView]);

  const buildCompact = useCallback(() => {
    if (!people.length) { setNodes([]); setEdges([]); setAxisInfo([]); return; }
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    const { nodes: n, edges: e, axisInfo: a } = buildCompactLayout(people, relationships, gens, edgeType);
    setNodes(n); setEdges(e); setAxisInfo(a);
  }, [people, relationships, edgeType, tree?.ownerPersonId, setNodes, setEdges]);

  const buildYearBased = useCallback(() => {
    if (!people.length) { setNodes([]); setEdges([]); return; }
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    const withData = people.map(p => { const d = p.birthDate ? parseISO(p.birthDate) : null; return { ...p, birthYear: d && isValid(d) ? getYear(d) : null, generation: gens.get(p.id) || 0 }; }).filter(p => p.generation > 0);
    const bys = withData.map(p => p.birthYear).filter((y): y is number => y !== null);
    const minY = bys.length ? Math.min(...bys) - 5 : new Date().getFullYear() - 50;
    const maxY = bys.length ? Math.max(...bys, new Date().getFullYear()) + 5 : new Date().getFullYear();
    setYearRange({ min: minY, max: maxY });
    const byG = new Map<number, typeof withData>();
    for (const p of withData) { if (!byG.has(p.generation)) byG.set(p.generation, []); byG.get(p.generation)!.push(p); }
    const newNodes: Node<Person>[] = [];
    const lastY = new Map<number, number>();
    for (const g of Array.from(byG.keys()).sort((a, b) => a - b)) {
      if (!g) continue;
      const gp = (byG.get(g) || []).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
      const x = 100 + (g - 1) * COLUMN_WIDTH;
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
      id: r.id, source: r.personAId, target: r.personBId, type: edgeType, animated: PARENT_REL_TYPES.includes(r.relationshipType), className: 'custom-edge', style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
    })));
    if (hadNone && newNodes.length) setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
  }, [people, relationships, edgeType, tree?.ownerPersonId, setNodes, setEdges, setViewport, nodes.length]);

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
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={centerOnOwner} disabled={!tree?.ownerPersonId}><LocateFixed className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>מרכז עליי</p></TooltipContent></Tooltip>
          <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><User className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <h4 className="text-sm font-medium p-2 border-b text-center">מי אתה בעץ?</h4>
              <ScrollArea className="h-72"><div className="p-2 space-y-1">
                {people.map(person => (
                  <Button key={person.id} variant={tree?.ownerPersonId === person.id ? 'default' : 'ghost'} className="w-full justify-start"
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
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={handleCtxMenu} nodeTypes={nodeTypes} fitView={false} className="ml-20" panOnDrag zoomOnScroll minZoom={0.05} maxZoom={4} nodesDraggable={false} nodesConnectable={false} defaultEdgeOptions={{ className: 'custom-edge', style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 } }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>
      {ctxMenu && (<TimelineContextMenu menu={ctxMenu} onOpenCard={handleOpenCard} onClose={() => setCtxMenu(null)} />)}
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
