'use client';
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  OnNodeContextMenu,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PersonNode } from '@/app/tree/[treeId]/person-node';
import { TimelineAxis } from './TimelineAxis';
import type { Person, Relationship } from '@/lib/types';
import { BackgroundVariant } from 'reactflow';
import type { EdgeType } from '../tree-page-client';
import { getYear, isValid, parseISO, differenceInYears } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';

const PIXELS_PER_YEAR = 80;
const NODE_HEIGHT = 76;
const MIN_VERTICAL_GAP = 16;
const COLUMN_WIDTH = 300;
const COMPACT_ROW_HEIGHT = 160; // Increased height for better spacing
const COMPACT_SIBLING_SPACING = 20;
const COMPACT_SPOUSE_SPACING = 10;
const COMPACT_FAMILY_UNIT_SPACING = 60;

const nodeTypes: NodeTypes = {
  timelinePerson: PersonNode, // Use the main PersonNode for visual consistency
};

// This component is now only used for the non-compact, year-based timeline
const GenerationAxis = memo(({ generations, rowHeight }: { generations: { gen: number; y: number; yearRange: string }[], rowHeight: number }) => {
  const transform = useStore(s => s.transform);
  const [viewportY, viewportZoom] = [transform[1], transform[2]];

  return (
    <div className="absolute left-0 top-0 h-full w-28 bg-muted/20 z-10 select-none overflow-hidden" style={{ pointerEvents: 'none' }}>
      <div className="relative h-full w-full" style={{ transform: `translateY(${viewportY}px)` }}>
        {generations.map(({ gen, y, yearRange }) => {
          const yPos = y * viewportZoom;
          return (
            <div key={gen} style={{ top: `${yPos}px`, height: `${rowHeight * viewportZoom}px` }} className="absolute right-0 w-full border-b border-border/10 flex items-center">
              <div className="absolute right-0 top-0 h-full w-px bg-border" />
              <div className="pr-3 -translate-y-1/2 absolute top-1/2 right-1">
                <div className="text-sm font-bold text-muted-foreground">דור {gen}</div>
                <div className="text-xs text-muted-foreground/70">{yearRange}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
GenerationAxis.displayName = "GenerationAxis";


const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
const PARTNER_REL_TYPES = ['spouse', 'partner', 'ex_spouse', 'ex_partner', 'separated', 'widowed'];
const SIBLING_REL_TYPES = ['sibling', 'twin', 'half_sibling', 'step_sibling'];


const assignGenerations = (people: Person[], relationships: Relationship[]): Map<string, number> => {
    const generations = new Map<string, number>();

    let changesMade = true;
    let iterations = 0;
    const MAX_ITERATIONS = people.length + 5; // Safety break for complex circular cases

    while (changesMade && iterations < MAX_ITERATIONS) {
        changesMade = false;
        iterations++;

        for (const person of people) {
            const currentGen = generations.get(person.id);
            let newGen: number | undefined = undefined;

            // --- Priority 1: Parents ---
            const parentRels = relationships.filter(r => r.personBId === person.id && PARENT_REL_TYPES.includes(r.relationshipType));
            const parentIds = parentRels.map(r => r.personAId);
            const parentGenerations = parentIds.map(pId => generations.get(pId)).filter((g): g is number => g !== undefined);
            
            if (parentGenerations.length > 0) {
                newGen = Math.max(...parentGenerations) + 1;
            }

            if (newGen !== undefined) {
                if (newGen !== currentGen) {
                    generations.set(person.id, newGen);
                    changesMade = true;
                }
                continue; // This person is handled, move to the next
            }
            
            // If no parent generation found yet, try other relationships

            // --- Priority 2: Partners ---
            const partnerRels = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && PARTNER_REL_TYPES.includes(r.relationshipType));
            const partnerIds = partnerRels.map(r => r.personAId === person.id ? r.personBId : r.personAId);
            const partnerGenerations = partnerIds.map(pId => generations.get(pId)).filter((g): g is number => g !== undefined);
            if (partnerGenerations.length > 0) {
                newGen = Math.max(...partnerGenerations); // Take the highest generation if multiple partners exist
            }
            
            if (newGen !== undefined) {
                 if (newGen !== currentGen) {
                    generations.set(person.id, newGen);
                    changesMade = true;
                }
                continue;
            }

            // --- Priority 3: Siblings ---
            const siblingRels = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && SIBLING_REL_TYPES.includes(r.relationshipType));
            const siblingIds = siblingRels.map(r => r.personAId === person.id ? r.personBId : r.personAId);
            const siblingGenerations = siblingIds.map(pId => generations.get(pId)).filter((g): g is number => g !== undefined);
            if (siblingGenerations.length > 0) {
                newGen = Math.max(...siblingGenerations);
            }

            if (newGen !== undefined) {
                 if (newGen !== currentGen) {
                    generations.set(person.id, newGen);
                    changesMade = true;
                }
                continue;
            }
        }
        
        // --- Priority 4: Default for anyone left ---
        // After iterating through relationships, any person without a generation is a root of their line
        for (const person of people) {
            if (!generations.has(person.id)) {
                generations.set(person.id, 1);
                changesMade = true;
            }
        }
    }
    
    if (iterations === MAX_ITERATIONS) {
        console.warn("assignGenerations reached max iterations. There might be a circular dependency or very complex structure.");
    }
    
    return generations;
};

// ... Rest of the TimelineView.tsx file (unchanged)
function TimelineViewContent({ people, relationships, edgeType, isCompact, onNodeDoubleClick }: { people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick; }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [yearRange, setYearRange] = useState({ min: 1900, max: 2024 });
  const { setViewport, fitView } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
  const { toast } = useToast();

  const handleNodeUnlock = (nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, draggable: true, data: { ...n.data, isLocked: false } } : n));
    toast({ title: "הכרטיס שוחרר להזזה" });
    setContextMenu(null);
  };
  const handleNodeLock = (nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, draggable: false, data: { ...n.data, isLocked: true } } : n));
    toast({ title: "הכרטיס ננעל" });
    setContextMenu(null);
  };

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const [generationAxisInfo, setGenerationAxisInfo] = useState<{ gen: number, y: number, yearRange: string }[]>([]);


  useEffect(() => {
    if (people.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (isCompact) {
      const generations = assignGenerations(people, relationships);
      const peopleWithGen = people.map(p => ({ ...p, generation: generations.get(p.id) || 0 }));
      const personMap = new Map(people.map(p => [p.id, p]));

      const peopleByGeneration = new Map<number, Person[]>();
      peopleWithGen.forEach(p => {
        const gen = p.generation;
        if (!peopleByGeneration.has(gen)) peopleByGeneration.set(gen, []);
        peopleByGeneration.get(gen)!.push(p);
      });

      const sortedGenKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);
      const newNodes: Node<Person>[] = [];
      const genInfoForAxis: { gen: number; y: number; yearRange: string }[] = [];

      let currentX = 0;
      for (const gen of sortedGenKeys) {
          if (gen === 0) continue;
          const yPos = (gen - 1) * COMPACT_ROW_HEIGHT;
          currentX = 0;

          const peopleInGen = peopleByGeneration.get(gen) || [];
          const processedInGen = new Set<string>();
          
          const birthYears = peopleInGen
            .map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getYear(parseISO(p.birthDate)) : null)
            .filter((y): y is number => y !== null);
          const minYear = birthYears.length > 0 ? Math.min(...birthYears) : null;
          const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : null;
          let yearRangeLabel = '';
          if (minYear && maxYear) {
            yearRangeLabel = minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`;
          }
          genInfoForAxis.push({ gen, y: yPos, yearRange: yearRangeLabel });

          // First pass: group spouses
          const familyUnits: (Person | Person[])[] = [];
          peopleInGen.forEach(person => {
              if (processedInGen.has(person.id)) return;
              
              const partnerRel = relationships.find(r => PARTNER_REL_TYPES.includes(r.relationshipType) && (r.personAId === person.id || r.personBId === person.id));
              const partnerId = partnerRel ? (partnerRel.personAId === person.id ? partnerRel.personBId : partnerRel.personAId) : null;
              const partner = partnerId ? personMap.get(partnerId) : null;
              
              if (partner && peopleInGen.some(p => p.id === partner.id)) {
                  familyUnits.push([person, partner]);
                  processedInGen.add(person.id);
                  processedInGen.add(partner.id);
              }
          });
          
          // Second pass: add remaining individuals (singles/siblings)
          peopleInGen.forEach(person => {
              if (!processedInGen.has(person.id)) {
                  familyUnits.push(person);
                  processedInGen.add(person.id);
              }
          });

          // Layout family units
          familyUnits.forEach(unit => {
              if (Array.isArray(unit)) { // It's a couple
                  const [p1, p2] = unit;
                  const rel = relationships.find(r => PARTNER_REL_TYPES.includes(r.relationshipType) && [r.personAId, r.personBId].sort().join(',') === [p1.id, p2.id].sort().join(','));
                  const isSeparated = rel && ['ex_spouse', 'separated', 'ex_partner'].includes(rel.relationshipType);
                  
                  newNodes.push({ id: p1.id, type: 'timelinePerson', position: { x: currentX, y: yPos }, data: p1, draggable: false });
                  currentX += 200 + (isSeparated ? 40 : COMPACT_SPOUSE_SPACING);
                  newNodes.push({ id: p2.id, type: 'timelinePerson', position: { x: currentX, y: yPos }, data: p2, draggable: false });
                  currentX += 200 + COMPACT_FAMILY_UNIT_SPACING;

              } else { // It's a single person (or sibling)
                  newNodes.push({ id: unit.id, type: 'timelinePerson', position: { x: currentX, y: yPos }, data: unit, draggable: false });
                  currentX += 200 + COMPACT_SIBLING_SPACING;
              }
          });
      }
      setGenerationAxisInfo(genInfoForAxis);
      setNodes(newNodes);
      setEdges(relationships.map(rel => ({
        id: rel.id,
        source: rel.personAId,
        target: rel.personBId,
        type: edgeType,
      })));
      setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 100);
      return;
    }
    
    // Default (non-compact) logic
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
          const idealY = person.birthYear !== null ? (person.birthYear - minYear) * PIXELS_PER_YEAR : lastOccupiedYinColumn.get(gen)! + NODE_HEIGHT + MIN_VERTICAL_GAP;
          const lastY = lastOccupiedYinColumn.get(gen)!;
          const yPos = Math.max(idealY, lastY + NODE_HEIGHT + MIN_VERTICAL_GAP);
          
          newNodes.push({ id: person.id, type: 'timelinePerson', position: { x: xPos, y: yPos }, data: person });
          lastOccupiedYinColumn.set(gen, yPos);
        }
    }
    
    setNodes(newNodes);
    setEdges(relationships.map(rel => ({ id: rel.id, source: rel.personAId, target: rel.personBId, type: edgeType, animated: PARENT_REL_TYPES.includes(rel.relationshipType) })));

    if (nodes.length === 0 && newNodes.length > 0) {
      setTimeout(() => setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 }), 100);
    }
  }, [people, relationships, edgeType, isCompact, setNodes, setEdges, setViewport, nodes.length, fitView]);

  return (
    <div className="h-full w-full relative bg-background">
      {isCompact && <GenerationAxis generations={generationAxisInfo} rowHeight={COMPACT_ROW_HEIGHT} />}
      {!isCompact && (
        <TimelineAxis minYear={yearRange.min} maxYear={yearRange.max} pixelsPerYear={PIXELS_PER_YEAR} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView={isCompact}
        className={isCompact ? "ml-28" : "ml-20"}
        panOnDrag={true}
        zoomOnScroll={true}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} className="left-4" />
      </ReactFlow>
       {contextMenu && (
        <Card ref={node => {
          if (node) {
            node.style.top = `${contextMenu.y}px`;
            node.style.left = `${contextMenu.x}px`;
          }
        }} className="absolute z-50 p-1" onContextMenu={e => e.preventDefault()}>
          <Button variant="ghost" className="w-full justify-start" onClick={() => onNodeDoubleClick && onNodeDoubleClick({} as React.MouseEvent, nodes.find(n => n.id === contextMenu.nodeId)!)}>פתח כרטיס</Button>
          {nodes.find(n => n.id === contextMenu.nodeId)?.data.isLocked ? (
              <Button variant="ghost" className="w-full justify-start" onClick={() => handleNodeUnlock(contextMenu.nodeId)}>נעל במקום</Button>
          ) : (
              <Button variant="ghost" className="w-full justify-start" onClick={() => handleNodeLock(contextMenu.nodeId)}>שחרר להזזה</Button>
          )}
        </Card>
      )}
    </div>
  );
}

export function TimelineView(props: { people: Person[]; relationships: Relationship[]; edgeType: EdgeType; isCompact: boolean; onNodeDoubleClick?: OnNodeDoubleClick; }) {
  return (
    <ReactFlowProvider>
      <TimelineViewContent {...props} />
    </ReactFlowProvider>
  );
}
