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
import { GenerationAxis } from './TimelineAxis'; // Changed from TimelineAxis
import type { Person, Relationship, FamilyTree } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { getYear, isValid, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, LocateFixed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// --- Constants ---
const NODE_WIDTH = 160;
const ROW_HEIGHT = 220; // Increased height for better spacing
const SPOUSE_GAP = 20;
const SEPARATED_GAP = 40;
const SIBLING_GAP = 80;
const FAMILY_GROUP_GAP = 100;

const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];
const SEPARATED_REL_TYPES = ['ex_spouse', 'separated', 'ex_partner'];

const nodeTypes: NodeTypes = { timelinePerson: TimelinePersonNode };

// --- Edge Props Logic ---
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
    targetHandle: aIsLeft ? 'left' : 'right',
  };
};

// --- Generation Assignment ---
const assignGenerations = (
  people: Person[],
  relationships: Relationship[],
  ownerId?: string
): Map<string, number> => {
  const gen = new Map<string, number>();

  const parentsOf = new Map<string, string[]>();
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
    const roots = people.filter(p => (parentsOf.get(p.id) || []).length === 0);
    if (roots.length > 0) {
      gen.set(roots[0].id, 1);
    } else if (people.length > 0) {
      gen.set(people[0].id, 1);
    }
  }

  let changed = true;
  for (let i = 0; i < people.length * 2 && changed; i++) {
    changed = false;
    for (const p of people) {
      const currentGen = gen.get(p.id);

      const parentGens = (parentsOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (parentGens.length > 0) {
        const newGen = Math.max(...parentGens) + 1;
        if (newGen !== currentGen) {
          gen.set(p.id, newGen);
          changed = true;
        }
        continue;
      }
      
      const childGens = (childrenOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
      if (childGens.length > 0) {
        const newGen = Math.min(...childGens) - 1;
        if (newGen !== currentGen) {
          gen.set(p.id, newGen);
          changed = true;
        }
        continue;
      }
      
      if (currentGen === undefined) {
         const partnerGens = (partnersOf.get(p.id) || []).map(id => gen.get(id)).filter((g): g is number => g !== undefined);
         if (partnerGens.length > 0) {
            gen.set(p.id, Math.max(...partnerGens));
            changed = true;
         }
      }
    }
  }

  const minGen = Math.min(...Array.from(gen.values()));
  if (minGen !== 1) {
    const offset = 1 - minGen;
    for (const [id, g] of gen.entries()) {
      gen.set(id, g + offset);
    }
  }
  return gen;
};

// --- Layout Algorithm ---
const buildCompactLayout = (
  people: Person[],
  relationships: Relationship[],
  generations: Map<string, number>,
  edgeType: EdgeType,
  ownerId?: string,
) => {
  const xPositions = new Map<string, number>();

  const paternalLine = new Set<string>();
  const maternalLine = new Set<string>();
  const visited = new Set<string>();

  if (ownerId) {
      const owner = people.find(p => p.id === ownerId);
      if (owner) {
        const parents = relationships.filter(r => r.personBId === ownerId && PARENT_REL_TYPES.includes(r.relationshipType)).map(r => people.find(p => p.id === r.personAId));
        const father = parents.find(p => p?.gender === 'male');
        const mother = parents.find(p => p?.gender === 'female');

        const traverse = (startNode: Person | undefined, lineSet: Set<string>) => {
            if (!startNode || visited.has(startNode.id)) return;
            const q = [startNode.id];
            visited.add(startNode.id);
            lineSet.add(startNode.id);
            let head = 0;
            while(head < q.length){
                const currentId = q[head++];
                const allRelated = relationships
                    .filter(r => r.personAId === currentId || r.personBId === currentId)
                    .flatMap(r => [r.personAId, r.personBId]);
                for (const relatedId of allRelated) {
                    if (!visited.has(relatedId)) {
                        visited.add(relatedId);
                        lineSet.add(relatedId);
                        q.push(relatedId);
                    }
                }
            }
        };

        traverse(father, paternalLine);
        traverse(mother, maternalLine);
        
        // Add owner to both if they are connected to both lines, or to one if not
        if(!paternalLine.size && !maternalLine.size) maternalLine.add(ownerId);
        else if(father) paternalLine.add(ownerId);
        else if(mother) maternalLine.add(ownerId);
      }
  }

  const unassigned = people.filter(p => !paternalLine.has(p.id) && !maternalLine.has(p.id));
  unassigned.forEach(p => maternalLine.add(p.id)); // Put remaining people in one line

  let currentX = 0;
  
  [paternalLine, maternalLine].forEach((line, lineIndex) => {
    if (lineIndex > 0 && paternalLine.size > 0) currentX += FAMILY_GROUP_GAP;
    
    const linePeople = people.filter(p => line.has(p.id));
    const lineRels = relationships.filter(r => line.has(r.personAId) && line.has(r.personBId));
    
    const genMap = new Map<number, Person[]>();
    linePeople.forEach(p => {
        const gen = generations.get(p.id) || 1;
        if (!genMap.has(gen)) genMap.set(gen, []);
        genMap.get(gen)!.push(p);
    });

    const genWidths = new Map<number, number>();
    const sortedGens = Array.from(genMap.keys()).sort((a,b)=>b-a);
    
    sortedGens.forEach(gen => {
        let width = 0;
        const genPeople = genMap.get(gen) || [];
        genPeople.forEach(p => {
            const children = lineRels.filter(r => r.personAId === p.id && PARENT_REL_TYPES.includes(r.relationshipType)).map(r => r.personBId);
            if (children.length > 0) {
                const childGen = generations.get(children[0])!;
                width += genWidths.get(childGen) || 0;
            } else {
                width += NODE_WIDTH + SIBLING_GAP;
            }
        });
        genWidths.set(gen, width);
    });

    const maxGenWidth = Math.max(0, ...Array.from(genWidths.values()));

    sortedGens.reverse().forEach(gen => {
        const genPeople = (genMap.get(gen) || []).sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || ''));
        const genWidth = genWidths.get(gen) || maxGenWidth;
        let startX = currentX + (maxGenWidth - genWidth) / 2;

        genPeople.forEach(p => {
            xPositions.set(p.id, startX);
            startX += NODE_WIDTH + SIBLING_GAP;
        });
    });
    currentX += maxGenWidth;
  });

  const nodes: Node<Person>[] = people.map(p => ({
    id: p.id, type: 'timelinePerson',
    position: { x: xPositions.get(p.id) ?? 0, y: ((generations.get(p.id) ?? 1) - 1) * ROW_HEIGHT },
    data: p, draggable: false, width: NODE_WIDTH,
  }));
  
  const edges: Edge[] = relationships
    .filter(r => people.some(p => p.id === r.personAId) && people.some(p => p.id === r.personBId))
    .map(rel => getEdgeProps(rel, nodes));

  const byGen = new Map<number, Person[]>();
  for (const p of people) {
    const g = generations.get(p.id) ?? 1;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }
  const axisInfo = Array.from(byGen.entries()).sort(([a], [b]) => a - b).map(([g, gp]) => {
    const ys = gp.map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null).filter((y): y is number => y !== null);
    const yr = ys.length ? (Math.min(...ys) === Math.max(...ys) ? `${Math.min(...ys)}` : `${Math.min(...ys)}–${Math.max(...ys)}`) : '';
    return { gen: g, y: (g - 1) * ROW_HEIGHT, yearRange: yr };
  });

  return { nodes, edges, axisInfo };
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
  const [axisInfo, setAxisInfo]          = useState<{ gen: number; y: number; yearRange: string }[]>([]);
  const [ownerOpen, setOwnerOpen]        = useState(false);
  const [ctxMenu, setCtxMenu]            = useState<CtxMenu | null>(null);
  const { fitView }         = useReactFlow();

  const centerOnOwner = useCallback(() => {
    if (!tree?.ownerPersonId) return;
    fitView({ nodes: [{ id: tree.ownerPersonId }], duration: 600, padding: 0.5 });
  }, [tree?.ownerPersonId, fitView]);

  useEffect(() => {
    const gens = assignGenerations(people, relationships, tree?.ownerPersonId);
    if (isCompact) {
        const { nodes: n, edges: e, axisInfo: a } = buildCompactLayout(people, relationships, gens, edgeType, tree?.ownerPersonId);
        setNodes(n); setEdges(e); setAxisInfo(a);
    }
  }, [people, relationships, tree, isCompact, edgeType, setNodes, setEdges, setAxisInfo]);


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
      {isCompact && <GenerationAxis axisInfo={axisInfo} rowHeight={ROW_HEIGHT} />}
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
        fitView
        className="ml-20"
        panOnDrag zoomOnScroll
        minZoom={0.05} maxZoom={4}
        nodesDraggable={false} nodesConnectable={false}
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
