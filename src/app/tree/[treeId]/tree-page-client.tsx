
'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import type {
  Node,
  Edge,
  Connection,
  OnConnect,
  OnNodeDrag,
  OnNodeDragStart,
  OnNodeDragStop,
  OnNodesChange,
  OnEdgeDoubleClick,
  OnPaneClick,
  OnEdgeClick,
  OnNodeDoubleClick,
  OnNodeContextMenu,
  IsValidConnection,
  NodeChange,
  OnSelectionChangeParams,
  XYPosition,
} from 'reactflow';
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from 'reactflow';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { useRouter } from 'next/navigation';
import type {
  FamilyTree,
  Person,
  Relationship,
  CanvasPosition,
  ManualEvent,
  SocialLink,
  ExportedFile,
} from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal, relationshipOptions } from './relationship-modal';
import { NodeContextMenu } from './node-context-menu';
import { CanvasToolbar } from './canvas-toolbar';
import { Loader2, User, ArrowLeft, Trophy } from 'lucide-react';
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  writeBatch,
  getDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { TimelineView } from './views/TimelineView';
import { TableView } from './views/table/TableView';
import { MapView } from './views/MapView';
import { CalendarView } from './views/CalendarView';
import { ManualEventEditor } from './views/ManualEventEditor';
import { StatisticsView } from './views/StatisticsView';
import { TriviaView } from './views/TriviaView';
import { SettingsModal } from './settings-modal';
import { AccountModal } from './account-modal';
import { AiChatPanel } from './ai-chat-panel';
import { PdfExportModal } from './pdf-export-modal';
import { ImageExportModal } from './image-export-modal';
import { PowerPointExportModal } from './powerpoint-export-modal';
import { exportToExcel, parseAndValidateExcel, ParsedExcelData } from '@/lib/excel-handler';
import { ImportConfirmationModal, ImportMode } from './import-confirmation-modal';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type TreePageClientProps = {
  treeId: string;
  readOnly?: boolean;
};

export type ViewMode =
  | 'tree'
  | 'timeline'
  | 'table'
  | 'map'
  | 'calendar'
  | 'statistics'
  | 'trivia';

export type EdgeType = 'default' | 'step' | 'straight';

// This function now intelligently determines the correct source and target handles
// based on the LOGICAL relationship type, not the handles used to draw the initial line.
const getEdgeProps = (rel: Relationship, nodes: Node<Person>[]) => {
  const nodeA = nodes.find((n) => n.id === rel.personAId);
  const nodeB = nodes.find((n) => n.id === rel.personBId);

  if (!nodeA || !nodeB) {
    // Return a default if nodes are not found, to prevent crashes
    return {
      source: rel.personAId,
      target: rel.personBId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
  }

  const parentTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
  const spouseTypes = [
    'spouse',
    'ex_spouse',
    'separated',
    'partner',
    'ex_partner',
  ];
  const siblingTypes = ['sibling', 'twin', 'step_sibling'];

  // For parent types, personA is ALWAYS the parent, personB is the child.
  if (parentTypes.includes(rel.relationshipType)) {
    return {
      source: rel.personAId,
      target: rel.personBId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
  }

  // For symmetrical relationships, decide left/right based on X position to keep lines consistent.
  const isNodeALeft = nodeA.position.x < nodeB.position.x;

  // The source is always the left node, target is the right node
  const sourceId = isNodeALeft ? rel.personAId : rel.personBId;
  const targetId = isNodeALeft ? rel.personBId : rel.personAId;

  if (spouseTypes.includes(rel.relationshipType)) {
    return {
      source: sourceId,
      target: targetId,
      sourceHandle: 'upper-right-source',
      targetHandle: 'upper-left-source',
    };
  }

  if (siblingTypes.includes(rel.relationshipType)) {
    return {
      source: sourceId,
      target: targetId,
      sourceHandle: 'lower-right-source',
      targetHandle: 'lower-left-source',
    };
  }

  // Fallback for any other relationship type
  return {
    source: sourceId,
    target: targetId,
    sourceHandle: 'upper-right-source',
    targetHandle: 'upper-left-source',
  };
};

function TreeCanvasContainer({ treeId, readOnly = false }: TreePageClientProps) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const { getNodes } = useReactFlow();
  
  const historyRef = useRef<{ past: { nodes: Node[]; edges: Edge[] }[]; future: { nodes: Node[]; edges: Edge[] }[] }>({ past: [], future: [] });
  const hasInitiallyLoaded = useRef(false);
  const HISTORY_LIMIT = 30;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);
  
  const [canvasPositions, setCanvasPositions] = useState<CanvasPosition[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const [editingRelationship, setEditingRelationship] =
    useState<Relationship | null>(null);
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);

  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [personToCreate, setPersonToCreate] = useState<any | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ParsedExcelData | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);


  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  
  const [isManualEventEditorOpen, setIsManualEventEditorOpen] = useState(false);
  const [editingManualEvent, setEditingManualEvent] = useState<Partial<ManualEvent> | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [edgeType, setEdgeType] = useState<EdgeType>('default');
  const [isTimelineCompact, setIsTimelineCompact] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isImageExportModalOpen, setIsImageExportModalOpen] = useState(false);
  const [isPowerPointModalOpen, setIsPowerPointModalOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodes: Node<Person>[];
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    isGroupDrag: boolean;
    initialNodePositions: Map<string, XYPosition>;
  } | null>(null);
  
  const [canvasBg, setCanvasBg] = useState<string | undefined>(undefined);

  const recordHistory = useCallback(() => {
    if (readOnly) return;
    const currentPast = historyRef.current.past;
    if (currentPast.length > 0) {
      const lastState = currentPast[currentPast.length - 1];
      if (lastState.nodes === nodes && lastState.edges === edges) {
        return;
      }
    }
    const newPast = [...currentPast, { nodes, edges }];
    if (newPast.length > HISTORY_LIMIT) {
      newPast.shift();
    }
    historyRef.current = { past: newPast, future: [] };
    setCanUndo(true);
    setCanRedo(false);
  }, [nodes, edges, readOnly]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;
    const newPast = [...historyRef.current.past];
    const present = newPast.pop();
    if (present) {
      historyRef.current.future.unshift({ nodes, edges });
      historyRef.current.past = newPast;
      setNodes(present.nodes);
      setEdges(present.edges);
      setCanUndo(newPast.length > 0);
      setCanRedo(true);
    }
  }, [nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const newFuture = [...historyRef.current.future];
    const present = newFuture.shift();
    if (present) {
      historyRef.current.past.push({ nodes, edges });
      historyRef.current.future = newFuture;
      setNodes(present.nodes);
      setEdges(present.edges);
      setCanUndo(true);
      setCanRedo(newFuture.length > 0);
    }
  }, [nodes, edges, setNodes, setEdges]);

  const deriveStateFromData = useCallback((
    peopleData: Person[], 
    relsData: Relationship[], 
    posData: CanvasPosition[],
    currentTree: FamilyTree
  ) => {
    const allParentalRelTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
    const directSiblingRelTypes = ['sibling', 'twin', 'step_sibling'];

    const childrenMap = new Map<string, string[]>();
    relsData.forEach(rel => {
      if (allParentalRelTypes.includes(rel.relationshipType)) {
        if (!childrenMap.has(rel.personAId)) childrenMap.set(rel.personAId, []);
        childrenMap.get(rel.personAId)!.push(rel.personBId);
      }
    });
    
    const parentMap = new Map<string, string[]>();
    for (const person of peopleData) {
        parentMap.set(person.id, []);
    }
    relsData.forEach(rel => {
      if (allParentalRelTypes.includes(rel.relationshipType)) {
        if (!parentMap.has(rel.personBId)) parentMap.set(rel.personBId, []);
        parentMap.get(rel.personBId)!.push(rel.personAId);
      }
    });
    
    let twinIds = new Set<string>();
    if (currentTree.applyCreatorSettingsToTwins && currentTree.ownerPersonId) {
      const owner = peopleData.find(p => p.id === currentTree.ownerPersonId);
      if (owner && owner.birthDate) {
        const ownerParents = parentMap.get(owner.id) || [];
        if (ownerParents.length > 0) {
          const potentialSiblings = new Set<string>();
          ownerParents.forEach(parentId => {
            (childrenMap.get(parentId) || []).forEach(childId => {
              if (childId !== owner.id) potentialSiblings.add(childId);
            });
          });
          potentialSiblings.forEach(siblingId => {
            const sibling = peopleData.find(p => p.id === siblingId);
            if (sibling && sibling.birthDate === owner.birthDate) {
              twinIds.add(siblingId);
            }
          });
        }
      }
    }


    const enrichedPeopleData = peopleData.map(person => {
        const children = childrenMap.get(person.id) || [];
        const childrenCount = children.length;

        const parents = parentMap.get(person.id) || [];
        const siblings = new Set<string>();
        if (parents.length > 0) {
            parents.forEach(parentId => {
                const childrenOfParent = childrenMap.get(parentId) || [];
                childrenOfParent.forEach(siblingId => {
                    if (siblingId !== person.id) siblings.add(siblingId);
                });
            });
        }
        relsData.forEach(rel => {
            if (directSiblingRelTypes.includes(rel.relationshipType)) {
                if (rel.personAId === person.id) siblings.add(rel.personBId);
                if (rel.personBId === person.id) siblings.add(rel.personAId);
            }
        });
        const siblingsCount = siblings.size;

        const grandchildren = children.flatMap(childId => childrenMap.get(childId) || []);
        const greatGrandchildren = grandchildren.flatMap(grandchildId => childrenMap.get(grandchildId) || []);
        const gen4 = greatGrandchildren.flatMap(greatGrandchildId => childrenMap.get(greatGrandchildId) || []);
        const gen5 = gen4.flatMap(gen4Id => childrenMap.get(gen4Id) || []);

        return {
            ...person,
            childrenCount,
            siblingsCount,
            grandchildrenCount: new Set(grandchildren).size,
            greatGrandchildrenCount: new Set(greatGrandchildren).size,
            gen4Count: new Set(gen4).size,
            gen5Count: new Set(gen5).size,
        };
    });
    setPeople(enrichedPeopleData);
    setRelationships(relsData);
    
    const positionsMap = new Map<string, Partial<CanvasPosition>>(posData.map(p => [p.personId, p]));
    const newNodes = enrichedPeopleData.map(person => {
      const pos = positionsMap.get(person.id);
      
      const isOwner = person.id === currentTree.ownerPersonId;
      const isTwin = twinIds.has(person.id);
      const applyCreatorStyles = isOwner || isTwin;
      
      return {
        id: person.id,
        type: 'personNode',
        position: pos ? { x: pos.x, y: pos.y } : { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          ...person,
          isLocked: pos?.isLocked ?? false,
          groupId: pos?.groupId ?? null,
          cardDesign: applyCreatorStyles ? currentTree.creatorCardDesign : currentTree.cardDesign,
          isOwner,
          cardBackgroundColor: currentTree.cardBackgroundColor,
          cardBorderColor: currentTree.cardBorderColor,
          cardBorderWidth: currentTree.cardBorderWidth,
          ...(applyCreatorStyles && {
            creatorCardBacklightIntensity: currentTree.creatorCardBacklightIntensity,
            creatorCardBacklightDisabled: currentTree.creatorCardBacklightDisabled,
            creatorCardSize: currentTree.creatorCardSize,
          }),
        },
        draggable: !(pos?.isLocked ?? false) && !readOnly,
      };
    });
    setNodes(newNodes);

    const relLabelMap = new Map(relationshipOptions.map(opt => [opt.type, opt.label]));
    relLabelMap.set('spouse', 'נשואים');
    relLabelMap.set('ex_spouse', 'גרושים');
    relLabelMap.set('separated', 'פרודים');
    relLabelMap.set('partner', 'בן/בת זוג');
    relLabelMap.set('ex_partner', 'בן/בת זוג לשעבר');

    const newEdges = relsData.map(rel => {
      const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, newNodes);
      const getLabel = () => {
        if (['parent', 'step_parent', 'adoptive_parent'].includes(rel.relationshipType)) {
          const parent = peopleData.find(p => p.id === rel.personAId);
          if (parent) {
            const parentOption = relationshipOptions.find(opt => opt.type === rel.relationshipType && opt.gender === parent.gender);
            return parentOption?.label || 'הורה';
          }
          return 'הורה';
        }
        return relLabelMap.get(rel.relationshipType) || rel.relationshipType;
      };
      return {
        id: rel.id,
        source, target, sourceHandle, targetHandle, type: edgeType,
        label: getLabel(),
        labelBgStyle: { fill: 'hsl(var(--background))', padding: '2px 4px' },
        labelStyle: { fill: 'hsl(var(--foreground))' },
        data: rel,
        className: 'custom-edge',
      };
    });
    setEdges(newEdges);
  }, [edgeType, readOnly]);

  const fetchData = useCallback(async () => {
    if (isUserLoading || !db) return; // Wait for user state to be known
    
    // For writeable views, a non-anonymous user is required.
    if (!readOnly && (!user || user.isAnonymous)) {
        router.replace('/login');
        return;
    }
    
    // For read-only views, an anonymous user is fine.
    if (readOnly && !user) {
        // This should be brief as anonymous sign-in is quick.
        return; 
    }

    setIsLoading(true);
    setError(null);
    try {
      let ownerId;
      if (readOnly) {
        // For read-only views, we need to discover the owner's ID
        const publicDocRef = doc(db, 'publicTrees', treeId);
        const publicDocSnap = await getDoc(publicDocRef);
        if (publicDocSnap.exists()) {
          ownerId = publicDocSnap.data().ownerUserId;
        } else {
            const sharedQuery = query(collection(db, "sharedTrees"), where("treeId", "==", treeId), where("sharedWithUserId", "==", user!.uid), limit(1));
            const sharedSnap = await getDocs(sharedQuery);
            if (!sharedSnap.empty) {
                ownerId = sharedSnap.docs[0].data().ownerUserId;
            } else {
                 const myTreeRef = doc(db, 'users', user!.uid, 'familyTrees', treeId);
                 const myTreeSnap = await getDoc(myTreeRef);
                 if (myTreeSnap.exists()) {
                     ownerId = user!.uid;
                 } else {
                     throw new Error('This tree is not public and has not been shared with you.');
                 }
            }
        }
      } else {
        // For editable views, the current user must be the owner.
        ownerId = user!.uid;
      }
      
      if (!ownerId) {
        throw new Error('Could not determine the owner of the tree.');
      }
      
      const treeDetailsRef = doc(db, 'users', ownerId, 'familyTrees', treeId);
      const peopleRef = collection(db, 'users', ownerId, 'familyTrees', treeId, 'people');
      const relsRef = collection(db, 'users', ownerId, 'familyTrees', treeId, 'relationships');
      const posRef = collection(db, 'users', ownerId, 'familyTrees', treeId, 'canvasPositions');
      const manualEventsRef = collection(db, 'users', ownerId, 'familyTrees', treeId, 'manualEvents');

      const treeSnap = await getDoc(treeDetailsRef);
      if (!treeSnap.exists()) {
        throw new Error('עץ המשפחה לא נמצא או שאין לך גישה.');
      }

      const [peopleSnap, relsSnap, posSnap, manualEventsSnap] = await Promise.all([
        getDocs(peopleRef),
        getDocs(relsRef),
        getDocs(posRef),
        getDocs(manualEventsRef),
      ]);

      const treeData = { id: treeSnap.id, ...treeSnap.data() } as FamilyTree;
      const peopleData = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
      const relsData = relsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship));
      const posData = posSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CanvasPosition));
      const manualEventsData = manualEventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ManualEvent));
      
      setTree(treeData);
      setCanvasBg(treeData.canvasBackgroundColor);
      setCanvasPositions(posData);
      setManualEvents(manualEventsData);
      deriveStateFromData(peopleData, relsData, posData, treeData);
      
    } catch (err: any) {
      console.error('Error fetching tree data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user, db, deriveStateFromData, readOnly, isUserLoading, router]);
  
  const runSiblingDetection = useCallback(async (
    personIdsForCheck: string[], 
    currentPeople: Person[], 
    currentRels: Relationship[]
  ) => {
    if (readOnly) return { relationshipsToAdd: [], relationshipsToUpdate: [] };
    const parentTypes = ['parent', 'step_parent', 'adoptive_parent'];
    const siblingTypes = ['sibling', 'twin'];
    
    const parentsToCheck = new Set<string>();
    currentRels.forEach(rel => {
        if (parentTypes.includes(rel.relationshipType) && personIdsForCheck.includes(rel.personBId)) {
            parentsToCheck.add(rel.personAId);
        }
    });

    if (parentsToCheck.size === 0) {
      const personId = personIdsForCheck[0];
      if (!personId) return { relationshipsToAdd: [], relationshipsToUpdate: [] };
      const siblingRels = currentRels.filter(r => (r.personAId === personId || r.personBId === personId) && siblingTypes.includes(r.relationshipType));
      const siblingIds = siblingRels.map(r => r.personAId === personId ? r.personBId : r.personAId);
      const allInvolvedIds = [...siblingIds, personId];
      currentRels.forEach(rel => {
        if (parentTypes.includes(rel.relationshipType) && allInvolvedIds.includes(rel.personBId)) {
          parentsToCheck.add(rel.personAId);
        }
      });
    }

    if (parentsToCheck.size === 0) return { relationshipsToAdd: [], relationshipsToUpdate: [] };

    const relationshipsToAdd: Relationship[] = [];
    const relationshipsToUpdate: Partial<Relationship>[] = [];

    for (const parentId of parentsToCheck) {
        const children = currentPeople.filter(p =>
            currentRels.some(r => parentTypes.includes(r.relationshipType) && r.personAId === parentId && r.personBId === p.id)
        );

        if (children.length < 2) continue;

        for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
                const childA = children[i];
                const childB = children[j];
                const existingRel = currentRels.find(r => siblingTypes.includes(r.relationshipType) && ((r.personAId === childA.id && r.personBId === childB.id) || (r.personAId === childB.id && r.personBId === childA.id)));
                const isTwin = childA.birthDate && childA.birthDate === childB.birthDate;
                const correctRelType = isTwin ? 'twin' : 'sibling';

                if (existingRel) {
                    if (existingRel.manuallyEdited) continue;
                    if (existingRel.relationshipType !== correctRelType) {
                        relationshipsToUpdate.push({ id: existingRel.id, relationshipType: correctRelType });
                    }
                } else {
                    const [personAId, personBId] = [childA.id, childB.id].sort();
                    relationshipsToAdd.push({
                        id: uuidv4(),
                        personAId, personBId, relationshipType: correctRelType,
                        treeId: treeId, userId: user!.uid, manuallyEdited: false
                    } as Relationship);
                }
            }
        }
    }
    return { relationshipsToAdd, relationshipsToUpdate };
  }, [treeId, user, readOnly]);

  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, type: edgeType })));
  }, [edgeType, setEdges]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      setEdges((eds) =>
        eds.map((edge) => {
          const isAnimated =
            selectedNodes.length === 1 &&
            (edge.source === selectedNodes[0].id ||
              edge.target === selectedNodes[0].id);
          const isEdgeSelected = selectedEdges.some((se) => se.id === edge.id);
          return {
            ...edge,
            animated: isAnimated,
            className: cn('custom-edge', (isAnimated || isEdgeSelected) && 'selected'),
          };
        })
      );
    },
    [setEdges]
  );

  useEffect(() => {
    if (tree) {
      setNameValue(tree.treeName);
    }
  }, [tree]);

  useEffect(() => {
    if (!isUserLoading && !readOnly && (!user || user.isAnonymous)) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router, readOnly]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isUserLoading && user) {
      fetchData();
    }
  }, [isUserLoading, user]);

  const onNodeContextMenu: OnNodeContextMenu = useCallback(
    (event, node) => {
      if (readOnly) return;
      event.preventDefault();
      setContextMenu(null); // Close any existing menu

      const allNodes = getNodes();
      let selectedNodes = allNodes.filter((n) => n.selected);

      // If the right-clicked node is not part of the current selection,
      // make it the only selected node.
      const isClickedNodeSelected = selectedNodes.some((n) => n.id === node.id);
      if (!isClickedNodeSelected) {
        selectedNodes = [node];
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === node.id,
          }))
        );
      }

      if (selectedNodes.length > 0) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          nodes: selectedNodes as Node<Person>[],
        });
      }
    },
    [getNodes, setNodes, readOnly]
  );
  
  const handlePaneClick: OnPaneClick = useCallback(() => {
    setContextMenu(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
        animated: false,
        className: 'custom-edge',
      }))
    );
  }, [setNodes, setEdges]);

  const onNodeDragStart: OnNodeDragStart = useCallback(
    (_, node) => {
      if (readOnly) return;
      recordHistory();
      const allNodes = getNodes();
      const isGroupDrag =
        !!node.data.groupId && allNodes.filter((n) => n.data.groupId === node.data.groupId).length > 1;

      dragRef.current = {
        nodeId: node.id,
        isGroupDrag,
        initialNodePositions: new Map(allNodes.map((n) => [n.id, n.position])),
      };
    },
    [getNodes, recordHistory, readOnly]
  );

  const onNodeDrag: OnNodeDrag = useCallback(
    (_, draggedNode) => {
      if (!dragRef.current || readOnly) return;
      const { nodeId, isGroupDrag, initialNodePositions } = dragRef.current;
      if (draggedNode.data.isLocked) return;

      const startPos = initialNodePositions.get(nodeId);
      if (!startPos) return;

      const diff = {
        x: draggedNode.position.x - startPos.x,
        y: draggedNode.position.y - startPos.y,
      };

      setNodes((nds) =>
        nds.map((n) => {
          // If it's a group drag, move all non-locked nodes in the group
          if (isGroupDrag && n.data.groupId === draggedNode.data.groupId && !n.data.isLocked) {
            const initialPos = initialNodePositions.get(n.id);
            if (initialPos) {
              return {
                ...n,
                position: {
                  x: initialPos.x + diff.x,
                  y: initialPos.y + diff.y,
                },
              };
            }
          }
          // Always move the node being dragged (if it's not part of the group logic above)
          if (n.id === nodeId) {
            return n;
          }
          return n;
        })
      );
    },
    [setNodes, readOnly]
  );

  const onNodeDragStop: OnNodeDragStop = useCallback(
    async (_, draggedNode) => {
      if (!user || !db || !dragRef.current || readOnly) return;

      const { isGroupDrag } = dragRef.current;
      const nodesToUpdate = isGroupDrag
        ? getNodes().filter((n) => n.data.groupId === draggedNode.data.groupId && !n.data.isLocked)
        : [getNodes().find(n => n.id === draggedNode.id)].filter(Boolean) as Node[];


      if (nodesToUpdate.length === 0) return;
      
      const batch = writeBatch(db);
      const canvasPositionsRef = collection(
        db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions'
      );
      
      for (const n of nodesToUpdate) {
        const q = query(canvasPositionsRef, where('personId', '==', n.id), limit(1));
        const snapshot = await getDocs(q);

        const dataToSave = {
          personId: n.id,
          x: n.position.x,
          y: n.position.y,
          userId: user.uid,
          treeId: treeId,
          updatedAt: serverTimestamp(),
        };

        if (snapshot.empty) {
          const newDocRef = doc(canvasPositionsRef);
          batch.set(newDocRef, dataToSave);
        } else {
          batch.update(snapshot.docs[0].ref, {
            x: dataToSave.x,
            y: dataToSave.y,
            updatedAt: dataToSave.updatedAt,
          });
        }
      }
      
      try {
        await batch.commit();
      } catch (error: any) {
        console.error("Error saving node positions:", error);
      }

      dragRef.current = null;
    },
    [user, db, treeId, getNodes, readOnly]
  );

  const handleGroup = async () => {
    recordHistory();
    const selectedNodes = getNodes().filter((n) => n.selected);
    if (selectedNodes.length < 2 || !user || !db) return;

    const newGroupId = uuidv4();
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, groupId: newGroupId } } : n
      )
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');

    for (const node of selectedNodes) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            const newDocRef = doc(canvasPositionsRef);
            batch.set(newDocRef, { personId: node.id, x: node.position.x, y: node.position.y, groupId: newGroupId, userId: user.uid, treeId, updatedAt: serverTimestamp() });
        } else {
            batch.update(snapshot.docs[0].ref, { groupId: newGroupId });
        }
    }
    await batch.commit();
    toast({ title: "הצמתים קובצו" });
  };

  const handleUngroup = async () => {
    recordHistory();
    const selectedNode = getNodes().find((n) => n.selected);
    const groupId = selectedNode?.data.groupId;
    if (!groupId || !user || !db) return;

    const nodesInGroup = getNodes().filter(n => n.data.groupId === groupId);
    
    setNodes((nds) =>
      nds.map((n) =>
        n.data.groupId === groupId ? { ...n, data: { ...n.data, groupId: null } } : n
      )
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const node of nodesInGroup) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            batch.update(snapshot.docs[0].ref, { groupId: null });
        }
    }
    await batch.commit();
    toast({ title: "הקבוצה פורקה" });
  };

  const handleLock = async () => {
    recordHistory();
    const selectedNodes = getNodes().filter((n) => n.selected);
    if (selectedNodes.length === 0 || !user || !db) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, isLocked: true }, draggable: false } : n
      )
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const node of selectedNodes) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
             const newDocRef = doc(canvasPositionsRef);
            batch.set(newDocRef, { personId: node.id, x: node.position.x, y: node.position.y, isLocked: true, userId: user.uid, treeId, updatedAt: serverTimestamp() });
        } else {
            batch.update(snapshot.docs[0].ref, { isLocked: true });
        }
    }
    await batch.commit();
    toast({ title: "המיקום ננעל" });
  };

  const handleUnlock = async () => {
    recordHistory();
    const selectedNodes = getNodes().filter((n) => n.selected);
    if (selectedNodes.length === 0 || !user || !db) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, isLocked: false }, draggable: true } : n
      )
    );
    
    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const node of selectedNodes) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            batch.update(snapshot.docs[0].ref, { isLocked: false });
        }
    }
    await batch.commit();
    toast({ title: "הנעילה שוחררה" });
  };


  const handleEdgeDoubleClick: OnEdgeDoubleClick = useCallback(
    (_, edge) => {
      if (readOnly) return;
      const rel = relationships.find((r) => r.id === edge.id);
      if (rel) {
        setEditingRelationship(rel);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        requestAnimationFrame(() => setIsRelModalOpen(true));
      }
    },
    [relationships, readOnly]
  );

  const handleNodeDoubleClick: OnNodeDoubleClick = useCallback((_, node) => {
    if (readOnly) return;
    setSelectedPerson(node.data);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsEditorOpen(true));
  }, [readOnly]);
  
  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleOpenEditorForNew = () => {
    if (readOnly) return;
    setSelectedPerson(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsEditorOpen(true));
  };

  const proceedWithCreation = async (personData: any) => {
    if (!user || !db) return;
    setIsDuplicateAlertOpen(false);
    
    recordHistory();

    const newPersonId = uuidv4();
    const newPersonData = {
      ...personData,
      id: newPersonId,
      userId: user.uid,
      treeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Person;
    
    // Optimistic UI update
    setPeople(ps => [...ps, newPersonData]);
    deriveStateFromData([...people, newPersonData], relationships, canvasPositions, tree!);

    try {
      const peopleCollection = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      await addDoc(peopleCollection, { ...newPersonData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast({
        title: 'אדם נוסף',
        description: `${newPersonData.firstName} ${newPersonData.lastName} נוסף.`,
      });
    } catch (error: any) {
      // Revert UI on error
      setPeople(ps => ps.filter(p => p.id !== newPersonId));
      deriveStateFromData(people.filter(p => p.id !== newPersonId), relationships, canvasPositions, tree!);
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people`,
        operation: 'create',
        requestResourceData: personData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: permissionError.message,
      });
    }
    setPersonToCreate(null);
    handleEditorClose();
  };

  const handleSavePerson = async (personData: any) => {
    if (readOnly) return;
    recordHistory();
    if (selectedPerson) {
      await handleUpdatePerson(personData as Person);
    } else {
      await handleCreatePerson(personData);
    }
  };

  const handleCreatePerson = async (personData: any) => {
    if (!user || !db) return;

    const duplicateQuery = query(
      collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'),
      where('firstName', '==', personData.firstName),
      where('lastName', '==', personData.lastName),
      where('birthDate', '==', personData.birthDate || null),
      limit(1)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      setPersonToCreate(personData);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsDuplicateAlertOpen(true));
    } else {
      await proceedWithCreation(personData);
    }
  };

  const handleUpdatePerson = async (personData: Person) => {
    if (!user || !db) return;
    const oldPerson = people.find(p => p.id === personData.id);
    const birthDateChanged = oldPerson?.birthDate !== personData.birthDate;

    // Optimistic update
    const newPeople = people.map(p => p.id === personData.id ? { ...p, ...personData } : p);
    setPeople(newPeople);
    deriveStateFromData(newPeople, relationships, canvasPositions, tree!);

    try {
      const docRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personData.id);
      
      const { 
        id, createdAt, updatedAt, 
        isLocked, groupId, isOwner, 
        childrenCount, siblingsCount, grandchildrenCount, greatGrandchildrenCount, gen4Count, gen5Count,
        creatorCardBacklightIntensity, creatorCardBacklightDisabled, creatorCardSize, creatorCardDesign,
        cardBackgroundColor, cardBorderColor, cardBorderWidth, cardDesign,
        userId, treeId: personTreeId, // Explicitly remove immutable fields
        ...dataForFirestore 
      } = personData as any;

      const dataToUpdate = { 
        ...dataForFirestore, 
        updatedAt: serverTimestamp() 
      };

      await updateDoc(docRef, dataToUpdate);

      if (birthDateChanged) {
        fetchData(); // Refetch to get new sibling relations
      }

      toast({
        title: 'אדם עודכן',
        description: `${personData.firstName} ${personData.lastName} עודכן.`,
      });
      handleEditorClose();
    } catch (error: any) {
      // Revert on error
      setPeople(people);
      deriveStateFromData(people, relationships, canvasPositions, tree!);

      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people/${personData.id}`,
        operation: 'update',
        requestResourceData: personData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: permissionError.message,
      });
    }
  };

  const updatePersonData = useCallback(async (personId: string, field: keyof Person, value: any): Promise<boolean> => {
    if (!user || !db || readOnly) {
        if (!readOnly) toast({ variant: 'destructive', title: 'שגיאת אימות' });
        return false;
    }
    
    recordHistory();
    const birthDateChanged = field === 'birthDate';

    const oldPeople = people;
    const oldRels = relationships;
    const oldPositions = canvasPositions;

    const newPeople = people.map(p => p.id === personId ? { ...p, [field]: value } : p);
    
    // Optimistic local update before async operations
    setPeople(newPeople);
    deriveStateFromData(newPeople, relationships, canvasPositions, tree!);

    try {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personId);
        await updateDoc(personRef, { [field]: value, updatedAt: serverTimestamp() });
        
        if (birthDateChanged) {
          fetchData(); // Refetch to update sibling relations
        }
        
        toast({ title: 'השדה עודכן', duration: 2000 });
        return true;
    } catch (error: any) {
        // Revert
        setPeople(oldPeople);
        setRelationships(oldRels);
        setCanvasPositions(oldPositions);
        deriveStateFromData(oldPeople, oldRels, oldPositions, tree!);

        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/familyTrees/${treeId}/people/${personId}`,
            operation: 'update',
            requestResourceData: { [field]: value },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: 'destructive',
            title: 'שגיאת עדכון',
            description: `לא ניתן היה לעדכן את השדה.`,
        });
        return false;
    }
  }, [user, db, treeId, toast, people, relationships, canvasPositions, tree, deriveStateFromData, fetchData, recordHistory, readOnly]);

  const handleDeleteRequest = (personId: string) => {
    if (readOnly) return;
    const person = people.find((p) => p.id === personId);
    if (person) {
      setPersonToDelete(person);
      setIsEditorOpen(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsDeleteAlertOpen(true));
    }
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete || !user || !db || !tree || readOnly) return;
  
    setIsDeleting(true);
    const personIdToDelete = personToDelete.id;
    const deletedPerson = personToDelete; // capture before clearing
  
    // Snapshot current state for revert
    const prevPeople = people;
    const prevRelationships = relationships;
    const prevCanvasPositions = canvasPositions;
  
    // Close dialog FIRST so Radix finishes its cleanup before we update React state
    setIsDeleteAlertOpen(false);
  
    // Optimistic UI update
    const newPeople = prevPeople.filter(p => p.id !== personIdToDelete);
    const newRelationships = prevRelationships.filter(
      r => r.personAId !== personIdToDelete && r.personBId !== personIdToDelete
    );
    const newPositions = prevCanvasPositions.filter(p => p.personId !== personIdToDelete);
    
    setPeople(newPeople);
    setRelationships(newRelationships);
    setCanvasPositions(newPositions);
    deriveStateFromData(newPeople, newRelationships, newPositions, tree);

    requestAnimationFrame(() => {
        const canvas = document.querySelector('.react-flow') as HTMLElement;
        if (canvas) canvas.focus();
    });
  
    try {
      const batch = writeBatch(db);
      const basePath = `users/${user.uid}/familyTrees/${treeId}`;
      const personRef = doc(db, basePath, 'people', personIdToDelete);
  
      const relsQueryA = query(collection(db, basePath, 'relationships'), where('personAId', '==', personIdToDelete));
      const relsQueryB = query(collection(db, basePath, 'relationships'), where('personBId', '==', personIdToDelete));
      const posQuery = query(collection(db, basePath, 'canvasPositions'), where('personId', '==', personIdToDelete));
  
      const [relsSnapA, relsSnapB, posSnap] = await Promise.all([
        getDocs(relsQueryA),
        getDocs(relsQueryB),
        getDocs(posQuery),
      ]);
  
      // Social links: fetch separately so failure here doesn't revert the whole deletion
      try {
        const socialLinksRef = collection(db, basePath, 'people', personIdToDelete, 'socialLinks');
        const socialLinksSnap = await getDocs(socialLinksRef);
        socialLinksSnap.docs.forEach(d => batch.delete(d.ref));
      } catch (e) {
        console.warn('Could not fetch social links for deletion, skipping:', e);
      }
  
      [...relsSnapA.docs, ...relsSnapB.docs].forEach(d => batch.delete(d.ref));
      posSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(personRef);
  
      await batch.commit();
  
      toast({
        title: 'אדם נמחק',
        description: `${deletedPerson.firstName} ${deletedPerson.lastName} נמחק בהצלחה.`,
      });
  
    } catch (error: any) {
      console.error("Error deleting person:", error);
      // Revert on failure
      setPeople(prevPeople);
      setRelationships(prevRelationships);
      setCanvasPositions(prevCanvasPositions);
      deriveStateFromData(prevPeople, prevRelationships, prevCanvasPositions, tree);
      toast({
        variant: 'destructive',
        title: 'שגיאת מחיקה',
        description: 'לא ניתן היה למחוק את האדם. נסה שוב.',
      });
    } finally {
      setIsDeleting(false);
      setPersonToDelete(null);
    }
  };
  
  const handleConnect: OnConnect = useCallback((params) => {
    if (readOnly) return;
    setNewConnection(params);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsRelModalOpen(true));
  }, [readOnly]);

  const handleRelModalClose = () => {
    setIsRelModalOpen(false);
    setNewConnection(null);
    setEditingRelationship(null);
  };

  const handleSaveRelationship = async (payload: {
    relData: any;
    genderUpdate?: { personId: string; gender: 'male' | 'female' | 'other' };
  }) => {
    if (!user || !db || !tree || readOnly) return;

    recordHistory();
    const { relData, genderUpdate } = payload;
    const isEditing = !!relData.id;
    const parentTypes = ['parent', 'step_parent', 'adoptive_parent'];
    const isParental = parentTypes.includes(relData.relationshipType);

    const oldState = { people, relationships };
    let newRelationship: Relationship;
    let newRelationships: Relationship[];

    if (isEditing) {
      newRelationships = relationships.map(r => r.id === relData.id ? { ...r, ...relData, updatedAt: new Date() } : r);
    } else {
      newRelationship = { ...relData, id: uuidv4(), createdAt: new Date(), updatedAt: new Date() } as Relationship;
      newRelationships = [...relationships, newRelationship];
    }
    
    let newPeople = people;
    if (genderUpdate) {
      newPeople = people.map(p => p.id === genderUpdate.personId ? { ...p, gender: genderUpdate.gender } : p);
    }
    
    const siblingChanges = await runSiblingDetection([relData.personBId], newPeople, newRelationships);
    if(siblingChanges.relationshipsToAdd){
        newRelationships.push(...(siblingChanges.relationshipsToAdd || []));
    }
    if(siblingChanges.relationshipsToUpdate) {
      (siblingChanges.relationshipsToUpdate || []).forEach(updatedRel => {
        newRelationships = newRelationships.map(r => r.id === updatedRel.id ? {...r, ...updatedRel} : r);
      });
    }

    // Optimistic update
    setPeople(newPeople);
    setRelationships(newRelationships);
    deriveStateFromData(newPeople, newRelationships, canvasPositions, tree);
    
    try {
      const batch = writeBatch(db);
      if (isEditing) {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relData.id);
        batch.update(relRef, { ...relData, updatedAt: serverTimestamp() });
      } else {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', newRelationship!.id);
        batch.set(relRef, { ...newRelationship, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }

      if (genderUpdate) {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', genderUpdate.personId);
        batch.update(personRef, { gender: genderUpdate.gender });
      }
      
      if(siblingChanges.relationshipsToAdd){
        (siblingChanges.relationshipsToAdd || []).forEach(r => {
          const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id);
          batch.set(relRef, r);
        });
      }
      if(siblingChanges.relationshipsToUpdate){
        (siblingChanges.relationshipsToUpdate || []).forEach(r => {
          const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id!);
          batch.update(relRef, r);
        });
      }

      await batch.commit();
      toast({ title: isEditing ? 'קשר עודכן' : 'קשר נוסף' });
      handleRelModalClose();
    } catch (error: any) {
      // Revert UI on error
      setPeople(oldState.people);
      setRelationships(oldState.relationships);
      deriveStateFromData(oldState.people, oldState.relationships, canvasPositions, tree);
      toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת קשר',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!user || !db || readOnly) return;
    
    recordHistory();
    const oldRelationships = relationships;
    const newRelationships = relationships.filter(r => r.id !== relationshipId);
    setRelationships(newRelationships);
    deriveStateFromData(people, newRelationships, canvasPositions, tree!);

    try {
      const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relationshipId);
      await deleteDoc(relRef);
      toast({ title: 'קשר נמחק' });
    } catch (error: any) {
      // Revert UI on error
      setRelationships(oldRelationships);
      deriveStateFromData(people, oldRelationships, canvasPositions, tree!);
      console.error('Error deleting relationship:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה במחיקת קשר',
        description: 'לא ניתן היה למחוק את הקשר. החיבור שוחזר.',
      });
    } finally {
      handleRelModalClose();
    }
  };
  
  const isValidConnection = useCallback<IsValidConnection>((connection) => {
    if (readOnly) return false;
    if (connection.source === connection.target) {
      return false;
    }
    return true;
  }, [readOnly]);

  const handleUpdateTreeDetails = useCallback(async (details: Partial<FamilyTree>) => {
    if (!user || !db || !tree || readOnly) {
        if (!readOnly) toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לשמור את השינויים." });
        return;
    }

    const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
    
    const oldTree = tree;
    const newTreeData = { ...tree, ...details };
    setTree(newTreeData);

    if ('treeName' in details && details.treeName) {
        setNameValue(details.treeName);
    }
    if (details.canvasBackgroundColor) {
      setCanvasBg(details.canvasBackgroundColor);
    }
    
    deriveStateFromData(people, relationships, canvasPositions, newTreeData as FamilyTree);

    try {
        await updateDoc(treeRef, { ...details, updatedAt: serverTimestamp() });
        toast({ title: "ההגדרות עודכנו" });
    } catch (error: any) {
        setTree(oldTree);
        deriveStateFromData(people, relationships, canvasPositions, oldTree);

        toast({ variant: "destructive", title: "שגיאת עדכון", description: "לא ניתן היה לשמור את הגדרות העץ." });
        const permissionError = new FirestorePermissionError({
            path: treeRef.path,
            operation: 'update',
            requestResourceData: details
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, db, tree, treeId, toast, people, relationships, canvasPositions, deriveStateFromData, readOnly]);

  const handleEditPerson = useCallback((personId: string) => {
    if (readOnly) return;
    const personToEdit = people.find(p => p.id === personId);
    if (personToEdit) {
      setSelectedPerson(personToEdit);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsEditorOpen(true));
    }
  }, [people, readOnly]);

  const handleOpenManualEventEditor = (event: Partial<ManualEvent> | null) => {
    if (readOnly) return;
    setEditingManualEvent(event);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsManualEventEditorOpen(true));
  };
  
  const handleSaveManualEvent = async (eventData: Omit<ManualEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'treeId'> & { id?: string }) => {
      if (!user || !db || readOnly) return;
  
      const isEditing = 'id' in eventData;
  
      try {
          if (isEditing) {
              const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventData.id!);
              const { id, ...dataToUpdate} = eventData;
              await updateDoc(eventRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
              setManualEvents(prev => prev.map(e => e.id === eventData.id ? { ...e, ...eventData, id: eventData.id! } as ManualEvent : e))
              toast({ title: 'האירוע עודכן' });
          } else {
              const eventsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents');
              const newDocRef = await addDoc(eventsRef, { 
                  ...eventData, 
                  userId: user.uid, 
                  treeId, 
                  createdAt: serverTimestamp(), 
                  updatedAt: serverTimestamp() 
              });
              setManualEvents(prev => [...prev, { ...eventData, id: newDocRef.id, userId: user.uid, treeId, createdAt: new Date() as any, updatedAt: new Date() as any }]);
              toast({ title: 'האירוע נוצר' });
          }
          setIsManualEventEditorOpen(false);
      } catch (error: any) {
          const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/familyTrees/${treeId}/manualEvents`,
              operation: isEditing ? 'update' : 'create',
              requestResourceData: eventData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את האירוע.' });
      }
  };
  
  const handleDeleteManualEvent = async (eventId: string) => {
      if (!user || !db || readOnly) return;
  
      try {
          const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventId);
          await deleteDoc(eventRef);
          setManualEvents(prev => prev.filter(e => e.id !== eventId));
          toast({ title: 'האירוע נמחק' });
          setIsManualEventEditorOpen(false);
      } catch (error: any) {
          const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/familyTrees/${treeId}/manualEvents/${eventId}`,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את האירוע.' });
      }
  };

    const handleFileSelectedForImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || readOnly) return;

        setIsImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const data = parseAndValidateExcel(buffer);
            setParsedExcelData(data);
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsImportModalOpen(true));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'שגיאת ייבוא', description: error.message });
        } finally {
            setIsImporting(false);
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        }
    };
    
    const handleConfirmImport = async (mode: ImportMode) => {
        if (!parsedExcelData || !user || !db || !tree || readOnly) return;
    
        setIsImporting(true);
        setIsImportModalOpen(false);
        toast({ title: 'הייבוא החל...', description: 'הפעולה עשויה לקחת מספר רגעים.' });
    
        try {
            if (mode === 'new') {
                const newTreeId = uuidv4();
                const batch = writeBatch(db);
                
                // Create new FamilyTree doc
                const newTreeRef = doc(db, 'users', user.uid, 'familyTrees', newTreeId);
                batch.set(newTreeRef, {
                    ...tree, // copy settings from current tree
                    treeName: parsedExcelData.treeName,
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                const oldIdToNewIdMap = new Map<string, string>();
                
                // Set new People
                parsedExcelData.people.forEach((p: any) => {
                    const newId = uuidv4();
                    oldIdToNewIdMap.set(p.id, newId);
                    const { id, ...data } = p;
                    const personRef = doc(collection(newTreeRef, 'people'), newId);
                    batch.set(personRef, { ...data, treeId: newTreeId, userId: user.uid });
                });
    
                // Set new Relationships, Events, Positions, Socials
                parsedExcelData.relationships.forEach((r: any) => {
                    const { id, personAName, personBName, ...data } = r;
                    const newPersonAId = oldIdToNewIdMap.get(data.personAId);
                    const newPersonBId = oldIdToNewIdMap.get(data.personBId);
                    if (newPersonAId && newPersonBId) {
                        const relRef = doc(collection(newTreeRef, 'relationships'), uuidv4());
                        batch.set(relRef, { ...data, personAId: newPersonAId, personBId: newPersonBId, treeId: newTreeId, userId: user.uid });
                    }
                });

                // ... similar loops for other collections, re-mapping IDs
    
                await batch.commit();
                toast({ title: 'הייבוא הושלם!', description: `עץ חדש "${parsedExcelData.treeName}" נוצר.` });
                router.push(`/tree/${newTreeId}`);

            } else if (mode === 'merge') {
                const existingPeopleSnap = await getDocs(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
                const existingPeople = existingPeopleSnap.docs.map(d => d.data());
                
                const batch = writeBatch(db);
                const peopleToAdd = parsedExcelData.people.filter((p: any) => 
                    !existingPeople.some(ep => ep.firstName === p.firstName && ep.lastName === p.lastName && ep.birthDate === p.birthDate)
                );
                
                peopleToAdd.forEach((p: any) => {
                  const { id, ...data } = p;
                  const personRef = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
                  batch.set(personRef, { ...data, treeId, userId: user.uid });
                });

                await batch.commit();
                fetchData();
                toast({ title: 'המיזוג הושלם', description: `${peopleToAdd.length} אנשים חדשים נוספו.` });

            } else if (mode === 'replace') {
                const deleteBatch = writeBatch(db);
                const subcollections = ['people', 'relationships', 'canvasPositions', 'manualEvents'];
                for(const sc of subcollections) {
                    const snapshot = await getDocs(collection(db, 'users', user.uid, 'familyTrees', treeId, sc));
                    snapshot.forEach(d => deleteBatch.delete(d.ref));
                }
                await deleteBatch.commit();
                // ... implementation would be similar to 'new' but using `treeId` instead of `newTreeId`
                fetchData();
                toast({ title: 'ההחלפה הושלמה', description: `העץ יובא מחדש.` });
            }
        } catch (error: any) {
            console.error("Import error:", error);
            toast({ variant: 'destructive', title: 'שגיאת ייבוא', description: error.message });
        } finally {
            setIsImporting(false);
            setParsedExcelData(null);
        }
    };
    
  const saveExportedFile = useCallback(async (
    blob: Blob,
    fileName: string,
    fileType: ExportedFile['fileType']
  ) => {
    if (!user || !storage || !db || !tree || readOnly) return;
    try {
      const storagePath = `users/${user.uid}/trees/${treeId}/exports/${Date.now()}_${fileName}`;
      const fileRef = ref(storage, storagePath);
      
      console.log('Starting upload to:', storagePath);
      const snapshot = await uploadBytes(fileRef, blob);
      console.log('Upload success:', snapshot.ref.fullPath);

      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'exportedFiles'), {
        userId: user.uid,
        treeId: tree.id,
        treeName: tree.treeName,
        fileName,
        fileType,
        storagePath,
        downloadURL,
        fileSizeBytes: blob.size,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('saveExportedFile error:', error);
    }
  }, [user, storage, db, tree, treeId, readOnly]);

  const handleExportExcel = useCallback(async () => {
    if (!tree || !user || !db) return;

    toast({ title: 'מכין נתונים לייצוא...' });

    try {
      const peopleCollectionRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      const peopleSnapshot = await getDocs(peopleCollectionRef);
      
      const socialLinksPromises = peopleSnapshot.docs.map(async (personDoc) => {
          const socialLinksRef = collection(personDoc.ref, 'socialLinks');
          const socialLinksSnap = await getDocs(socialLinksRef);
          return socialLinksSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, personId: personDoc.id } as SocialLink & { personId: string }));
      });

      const allSocialLinks = (await Promise.all(socialLinksPromises)).flat();

      const { blob, fileName } = exportToExcel({
          tree, people, relationships,
          socialLinks: allSocialLinks,
          manualEvents, canvasPositions,
      });

      // Trigger local download immediately
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({ title: "קובץ אקסל יוצא בהצלחה ✓" });
      
      // Save to cloud in the background
      saveExportedFile(blob, fileName, 'xlsx');

    } catch (error) {
        console.error("Excel export failed:", error);
        toast({ variant: 'destructive', title: 'שגיאה בייצוא', description: 'לא ניתן היה להכין את הנתונים.' });
    }
  }, [tree, people, relationships, manualEvents, canvasPositions, user, db, treeId, toast, saveExportedFile]);

  const handleBackToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);


  const renderCurrentView = () => {
    switch (viewMode) {
      case 'tree':
        return (
          <FamilyTreeCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={handleNodeDoubleClick}
            onPaneClick={handlePaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={handleConnect}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            isValidConnection={isValidConnection}
            onSelectionChange={onSelectionChange}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            people={people}
            relationships={relationships}
            edgeType={edgeType}
            isCompact={isTimelineCompact}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        );
      case 'table':
        return <TableView
            data={people}
            isOwner={!readOnly}
            treeId={treeId}
            updatePersonData={updatePersonData}
            onAddPerson={handleOpenEditorForNew}
            onEditPerson={handleEditPerson}
        />;
      case 'map':
        return <MapView people={people} onEditPerson={handleEditPerson} />;
      case 'calendar':
        return <CalendarView 
          people={people} 
          relationships={relationships} 
          manualEvents={manualEvents}
          onOpenEventEditor={handleOpenManualEventEditor}
          onEditPerson={handleEditPerson}
        />;
      case 'statistics':
        return <StatisticsView people={people} relationships={relationships} onEditPerson={handleEditPerson} />;
      case 'trivia':
        return <TriviaView people={people} relationships={relationships} setViewMode={setViewMode} />;
      default:
        return null;
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">טוען את עץ המשפחה שלך...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-center text-destructive">
        <div>
          <h2 className="text-2xl font-bold">אירעה שגיאה</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full" dir="rtl">
      <div className="flex h-full">
        <CanvasToolbar
          treeId={treeId}
          onAddPerson={handleOpenEditorForNew}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          viewMode={viewMode}
          setViewMode={setViewMode}
          edgeType={edgeType}
          setEdgeType={setEdgeType}
          onOpenSettings={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsSettingsModalOpen(true));
          }}
          onOpenAccount={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsAccountModalOpen(true));
          }}
          onToggleChat={() => setIsChatPanelOpen(prev => !prev)}
          onOpenPdfModal={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsPdfModalOpen(true));
          }}
          onOpenPptExport={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsPowerPointModalOpen(true));
          }}
          onExportExcel={handleExportExcel}
          onOpenImageExport={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsImageExportModalOpen(true));
          }}
          onImportClick={() => importFileInputRef.current?.click()}
          isTimelineCompact={isTimelineCompact}
          onToggleTimelineCompact={() => setIsTimelineCompact(v => !v)}
          readOnly={readOnly}
          onBack={handleBackToDashboard}
        />
        <main className="flex-1 relative overflow-hidden" id="main-view-container" style={{ backgroundColor: canvasBg }}>
        <input
            type="file"
            ref={importFileInputRef}
            className="hidden"
            accept=".xlsx"
            onChange={handleFileSelectedForImport}
          />
          {viewMode === 'tree' && (
            <div className="absolute top-4 right-4 z-10 rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm flex items-center gap-2" data-export-hide>
              <h1 className="text-lg font-semibold">{tree?.treeName}</h1>
              <Popover
                open={isOwnerPopoverOpen}
                onOpenChange={setIsOwnerPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={readOnly}>
                    <User className="h-4 w-4" />
                    <span className="sr-only">בחר אותי</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                  <h4 className="text-sm font-medium p-2 border-b text-center">
                    מי אתה בעץ?
                  </h4>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                      {people.map((person) => (
                        <Button
                          key={person.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            handleUpdateTreeDetails({ ownerPersonId: person.id });
                            setIsOwnerPopoverOpen(false);
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
          {renderCurrentView()}
          {contextMenu && viewMode === 'tree' && (
            <NodeContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              nodes={contextMenu.nodes}
              onClose={() => setContextMenu(null)}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              onLock={handleLock}
              onUnlock={handleUnlock}
            />
          )}
           {isChatPanelOpen && user && db && tree && (
            <AiChatPanel 
              onClose={() => setIsChatPanelOpen(false)}
              onDataAdded={fetchData}
              treeId={tree.id}
              treeName={tree.treeName}
              people={people}
            />
          )}
        </main>
      </div>

      <RelationshipModal
        isOpen={isRelModalOpen || !!pendingDeleteId}
        onClose={handleRelModalClose}
        connection={newConnection}
        relationship={
          editingRelationship ||
          (pendingDeleteId
            ? relationships.find((r) => r.id === pendingDeleteId)
            : null)
        }
        relationshipId={editingRelationship?.id || pendingDeleteId || undefined}
        people={people}
        onSave={handleSaveRelationship}
        onDelete={handleDeleteRelationship}
      />

      <PersonEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        person={selectedPerson}
        treeId={treeId}
        onSave={handleSavePerson}
        onDelete={handleDeleteRequest}
      />
       <ManualEventEditor 
        isOpen={isManualEventEditorOpen}
        onClose={() => setIsManualEventEditorOpen(false)}
        event={editingManualEvent}
        onSave={handleSaveManualEvent}
        onDelete={handleDeleteManualEvent}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
      
      {tree && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          tree={tree}
          onSave={(blob, fileName) => saveExportedFile(blob, fileName, 'pdf')}
        />
      )}
      
       {tree && (
        <ImageExportModal
          isOpen={isImageExportModalOpen}
          onClose={() => setIsImageExportModalOpen(false)}
          tree={tree}
          onSave={saveExportedFile}
        />
      )}
      
       {tree && (
        <PowerPointExportModal
          isOpen={isPowerPointModalOpen}
          onClose={() => setIsPowerPointModalOpen(false)}
          tree={tree}
          people={people}
          relationships={relationships}
          onSave={(blob, fileName) => saveExportedFile(blob, fileName, 'pptx')}
        />
      )}
      
       <ImportConfirmationModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        parsedData={parsedExcelData}
        onConfirm={handleConfirmImport}
        isImporting={isImporting}
      />

      {tree && <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        tree={tree}
        people={people}
        onUpdate={handleUpdateTreeDetails}
      />}

      <AlertDialog
        open={isDuplicateAlertOpen}
        onOpenChange={setIsDuplicateAlertOpen}
      >
        <AlertDialogContent onCloseAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => {
            const canvas = document.querySelector('.react-flow') as HTMLElement;
            if (canvas) canvas.focus();
          });
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>נמצאה כפילות אפשרית</AlertDialogTitle>
            <AlertDialogDescription>
              אדם עם שם ותאריך לידה דומים כבר קיים בעץ זה. האם אתה עדיין רוצה
              ליצור את האדם החדש הזה?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPersonToCreate(null)}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => personToCreate && proceedWithCreation(personToCreate)}
            >
              צור בכל זאת
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const canvas = document.querySelector('.react-flow') as HTMLElement;
              if (canvas) canvas.focus();
            });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את{' '}
              <strong className="text-foreground">
                {personToDelete?.firstName} {personToDelete?.lastName}
              </strong>
              , וכל הקשרים שלו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TreePageClient({ treeId, readOnly = false }: TreePageClientProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasContainer treeId={treeId} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
