
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
  useNodesState,
  useEdgesState,
  useStore,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from 'reactflow';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type {
  FamilyTree,
  Person,
  Relationship,
  CanvasPosition,
  ManualEvent,
} from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal, relationshipOptions } from './relationship-modal';
import { NodeContextMenu } from './node-context-menu';
import { CanvasToolbar } from './canvas-toolbar';
import { Loader2, User } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
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
import { SettingsModal } from './settings-modal';
import { AccountModal } from './account-modal';
import { AiChatPanel } from './ai-chat-panel';

type TreePageClientProps = {
  treeId: string;
};

export type ViewMode =
  | 'tree'
  | 'timeline'
  | 'table'
  | 'map'
  | 'calendar'
  | 'statistics';

export type EdgeType = 'smoothstep' | 'step' | 'default' | 'straight';

const getEdgeStyle = (selected = false) => ({
  strokeWidth: selected ? 2.5 : 1.5,
  stroke: selected ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
});

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

function TreeCanvasContainer({ treeId }: TreePageClientProps) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { getNodes } = useReactFlow();

  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => (s.past?.length ?? 0) > 0);
  const canRedo = useStore((s) => (s.future?.length ?? 0) > 0);

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  
  const [isManualEventEditorOpen, setIsManualEventEditorOpen] = useState(false);
  const [editingManualEvent, setEditingManualEvent] = useState<Partial<ManualEvent> | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [edgeType, setEdgeType] = useState<EdgeType>('smoothstep');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

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
            style: getEdgeStyle(isAnimated || isEdgeSelected),
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
  }, [tree?.treeName]);

  useEffect(() => {
    if (!isUserLoading && (!user || user.isAnonymous)) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user || user.isAnonymous || !db) return;
    setIsLoading(true);
    setError(null);
    try {
      const treeDetailsRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
      const peopleRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships');
      const posRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
      const manualEventsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents');

      const treeSnap = await getDoc(treeDetailsRef);
      if (!treeSnap.exists()) {
        throw new Error('עץ המשפחה לא נמצא או שאין לך גישה.');
      }

      const [peopleSnap, relsSnap, posSnap, manualEventsSnap] = await Promise.all([
        getDocs(peopleRef),
        getDocs(relsRef),
        getDocs(posRef),
        getDocs(manualEventsSnap),
      ]);

      const treeData = { id: treeSnap.id, ...treeSnap.data() } as FamilyTree;
      const peopleData = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
      const relsData = relsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship));
      const posData = posSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CanvasPosition));
      const manualEventsData = manualEventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ManualEvent));

      setTree(treeData);
      setPeople(peopleData);
      setRelationships(relsData);
      setManualEvents(manualEventsData);

      const positionsMap = new Map<string, Partial<CanvasPosition>>(
        posData.map((p) => [p.personId, p])
      );

      const initialNodes = peopleData.map((person) => {
        const pos = positionsMap.get(person.id);
        const personWithUiState: Person = {
          ...person,
          isLocked: pos?.isLocked ?? false,
          groupId: pos?.groupId ?? null,
          isOwner: person.id === treeData.ownerPersonId,
        };

        return {
          id: person.id,
          type: 'personNode',
          position: pos ? { x: pos.x, y: pos.y } : { x: Math.random() * 400, y: Math.random() * 400 },
          data: personWithUiState,
          draggable: !(pos?.isLocked ?? false),
        };
      });
      setNodes(initialNodes);

      const relLabelMap = new Map(
        relationshipOptions.map((opt) => [opt.type, opt.label])
      );
      // Fallback for types that might map to the same base type but have different labels in the modal
      relLabelMap.set('spouse', 'נשואים');
      relLabelMap.set('ex_spouse', 'גרושים');
      relLabelMap.set('separated', 'פרודים');
      relLabelMap.set('partner', 'בן/בת זוג');
      relLabelMap.set('ex_partner', 'בן/בת זוג לשעבר');

      const initialEdges = relsData.map((rel) => {
        const { source, target, sourceHandle, targetHandle } = getEdgeProps(
          rel,
          initialNodes
        );
        const getLabel = () => {
          if (
            rel.relationshipType === 'parent' ||
            rel.relationshipType === 'step_parent' ||
            rel.relationshipType === 'adoptive_parent'
          ) {
            const parent = peopleData.find((p) => p.id === rel.personAId);
            if (parent) {
              const parentOption = relationshipOptions.find(
                (opt) =>
                  opt.type === rel.relationshipType &&
                  opt.gender === parent.gender
              );
              return parentOption?.label || 'הורה';
            }
            return 'הורה';
          }
          return relLabelMap.get(rel.relationshipType) || rel.relationshipType;
        };

        return {
          id: rel.id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: edgeType,
          label: getLabel(),
          labelBgStyle: { fill: 'hsl(var(--background))', padding: '2px 4px' },
          labelStyle: { fill: 'hsl(var(--foreground))' },
          data: rel,
          style: getEdgeStyle(false),
        };
      });
      setEdges(initialEdges);
    } catch (err: any) {
      console.error('Error fetching tree data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user, db, setNodes, setEdges, edgeType]);

  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      fetchData();
    }
  }, [fetchData, isUserLoading, user]);

  const onNodeContextMenu: OnNodeContextMenu = useCallback(
    (event, node) => {
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
    [getNodes, setNodes]
  );
  
  const handlePaneClick: OnPaneClick = useCallback(() => {
    setContextMenu(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
        animated: false,
        style: getEdgeStyle(false),
      }))
    );
  }, [setNodes, setEdges]);

  const onNodeDragStart: OnNodeDragStart = useCallback(
    (_, node) => {
      const allNodes = getNodes();
      const isGroupDrag =
        !!node.data.groupId && allNodes.filter((n) => n.data.groupId === node.data.groupId).length > 1;

      dragRef.current = {
        nodeId: node.id,
        isGroupDrag,
        initialNodePositions: new Map(allNodes.map((n) => [n.id, n.position])),
      };
    },
    [getNodes]
  );

  const onNodeDrag: OnNodeDrag = useCallback(
    (_, draggedNode) => {
      if (!dragRef.current) return;
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
    [setNodes]
  );

  const onNodeDragStop: OnNodeDragStop = useCallback(
    async (_, draggedNode) => {
      if (!user || !db || !dragRef.current) return;

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
    [user, db, treeId, getNodes]
  );

  const handleGroup = async () => {
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
      const rel = relationships.find((r) => r.id === edge.id);
      if (rel) {
        setEditingRelationship(rel);
        setIsRelModalOpen(true);
      }
    },
    [relationships]
  );

  const handleNodeDoubleClick: OnNodeDoubleClick = useCallback((_, node) => {
    setSelectedPerson(node.data);
    setIsEditorOpen(true);
  }, []);
  
  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleOpenEditorForNew = () => {
    setSelectedPerson(null);
    setIsEditorOpen(true);
  };

  const proceedWithCreation = async (personData: any) => {
    if (!user || !db) return;
    setIsDuplicateAlertOpen(false);

    const data = {
      ...personData,
      userId: user.uid,
      treeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const peopleCollection = collection(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'people'
      );
      const docRef = await addDoc(peopleCollection, data);
      const newPerson = { id: docRef.id, ...data };
      toast({
        title: 'אדם נוסף',
        description: `${newPerson.firstName} ${newPerson.lastName} נוסף.`,
      });
      fetchData();
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people`,
        operation: 'create',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: permissionError.message,
      });
    }
    setPersonToCreate(null);
  };

  const handleSavePerson = async (personData: any) => {
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
      setIsDuplicateAlertOpen(true);
    } else {
      await proceedWithCreation(personData);
      handleEditorClose();
    }
  };

  const handleUpdatePerson = async (personData: Person) => {
    if (!user || !db) return;
    try {
      const docRef = doc(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'people',
        personData.id
      );
      const dataToUpdate = { ...personData, updatedAt: serverTimestamp() };
      await updateDoc(docRef, dataToUpdate);
      toast({
        title: 'אדם עודכן',
        description: `${personData.firstName} ${personData.lastName} עודכן.`,
      });
      fetchData();
      handleEditorClose();
    } catch (error: any) {
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

  const updatePersonData = useCallback(async (personId: string, field: keyof Person, value: any) => {
    if (!user || !db) {
        toast({ variant: 'destructive', title: 'שגיאת אימות' });
        return false;
    }
    try {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personId);
        await updateDoc(personRef, { [field]: value, updatedAt: serverTimestamp() });
        // Update local state for immediate feedback
        setPeople(prev => prev.map(p => p.id === personId ? { ...p, [field]: value } : p));
        toast({ title: 'השדה עודכן', duration: 2000 });
        return true;
    } catch (error: any) {
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
  }, [user, db, treeId, toast]);

  const handleDeleteRequest = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (person) {
      setPersonToDelete(person);
      setIsEditorOpen(false);
      setIsDeleteAlertOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete || !user || !db) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      const personRef = doc(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'people',
        personToDelete.id
      );
      batch.delete(personRef);

      const relsRef = collection(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'relationships'
      );
      const relsQuery1 = query(
        relsRef,
        where('personAId', '==', personToDelete.id)
      );
      const relsQuery2 = query(
        relsRef,
        where('personBId', '==', personToDelete.id)
      );

      const [rels1Snapshot, rels2Snapshot] = await Promise.all([
        getDocs(relsQuery1),
        getDocs(rels2Snapshot),
      ]);
      rels1Snapshot.forEach((doc) => batch.delete(doc.ref));
      rels2Snapshot.forEach((doc) => batch.delete(doc.ref));

      const posRef = collection(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'canvasPositions'
      );
      const posQuery = query(
        posRef,
        where('personId', '==', personToDelete.id),
        limit(1)
      );
      const posSnapshot = await getDocs(posQuery);
      if (!posSnapshot.empty) {
        batch.delete(posSnapshot.docs[0].ref);
      }

      await batch.commit();
      toast({
        title: 'אדם נמחק',
        description: `${personToDelete.firstName} ${personToDelete.lastName} נמחק מהעץ.`,
      });
      fetchData();
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people/${personToDelete.id}`,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאת מחיקה',
        description: 'Failed to delete person and their relationships.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
      setPersonToDelete(null);
    }
  };

  const handleConnect: OnConnect = useCallback((params) => {
    setNewConnection(params);
    setIsRelModalOpen(true);
  }, []);

  const handleRelModalClose = () => {
    setIsRelModalOpen(false);
    setNewConnection(null);
    setEditingRelationship(null);
  };

  const handleSaveRelationship = async (payload: {
    relData: any;
    genderUpdate?: { personId: string; gender: 'male' | 'female' | 'other' };
  }) => {
    if (!user || !db) return;
    const { relData, genderUpdate } = payload;
    const isEditing = !!editingRelationship;
    try {
      const batch = writeBatch(db);
      if (isEditing) {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relData.id);
        const dataToUpdate = { ...relData, updatedAt: serverTimestamp() };
        delete dataToUpdate.id;
        batch.update(relRef, dataToUpdate);
      } else {
        const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships');
        const newDocRef = doc(relsRef);
        const dataToCreate = {
          ...relData,
          userId: user.uid,
          treeId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        delete dataToCreate.id;
        batch.set(newDocRef, dataToCreate);
      }
      if (genderUpdate) {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', genderUpdate.personId);
        batch.update(personRef, { gender: genderUpdate.gender });
      }
      await batch.commit();
      toast({ title: isEditing ? 'קשר עודכן' : 'קשר נוסף' });
      fetchData();
      handleRelModalClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת קשר',
        description: error.message || 'An unexpected error occurred.',
      });
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/relationships`,
        operation: isEditing ? 'update' : 'create',
        requestResourceData: relData,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!user || !db) return;

    let edgeToDelete: any;
    setEdges((currentEdges) => {
      edgeToDelete = currentEdges.find((e) => e.id === relationshipId);
      return currentEdges.filter((e) => e.id !== relationshipId);
    });

    try {
      const relRef = doc(
        db,
        'users',
        user.uid,
        'familyTrees',
        treeId,
        'relationships',
        relationshipId
      );
      await deleteDoc(relRef);
      setRelationships((rels) => rels.filter((r) => r.id !== relationshipId));
      toast({ title: 'קשר נמחק' });
    } catch (error: any) {
      console.error('Error deleting relationship:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה במחיקת קשר',
        description: 'לא ניתן היה למחוק את הקשר. החיבור שוחזר.',
      });
      if (edgeToDelete) {
        setEdges((currentEdges) => [...currentEdges, edgeToDelete!]);
      }
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/relationships/${relationshipId}`,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      handleRelModalClose();
    }
  };
  
  const isValidConnection = useCallback<IsValidConnection>((connection) => {
    // Basic validation: prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }
    const sideHandles = [
      'upper-left-source',
      'upper-left-target',
      'upper-right-source',
      'upper-right-target',
      'lower-left-source',
      'lower-left-target',
      'lower-right-source',
      'lower-right-target',
    ];

    // Allow connections between any two side handles
    if (
      sideHandles.includes(connection.sourceHandle!) &&
      sideHandles.includes(connection.targetHandle!)
    ) {
      return true;
    }

    // Allow default parent (bottom) to child (top) connections
    if (connection.sourceHandle === 'bottom' && connection.targetHandle === 'top') {
      return true;
    }

    // You might want to allow the reverse as well for user convenience
    if (connection.sourceHandle === 'top' && connection.targetHandle === 'bottom') {
      return true;
    }

    // Disallow all other connections (e.g., side to top/bottom)
    return false;
  }, []);

  const handleUpdateTreeDetails = useCallback(async (details: Partial<FamilyTree>) => {
    if (!user || !db || !tree) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לשמור את השינויים." });
        return;
    }

    const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
    
    // Optimistic UI update
    const oldTree = tree;
    setTree(prev => prev ? { ...prev, ...details } : null);

    if ('treeName' in details) {
        setNameValue(details.treeName!);
    }
     if ('ownerPersonId' in details) {
        setNodes((nds) =>
          nds.map((n) => ({ ...n, data: { ...n.data, isOwner: n.id === details.ownerPersonId } }))
        );
    }

    try {
        await updateDoc(treeRef, { ...details, updatedAt: serverTimestamp() });
        toast({ title: "ההגדרות עודכנו" });
    } catch (error: any) {
        // Revert UI on error
        setTree(oldTree);
        if ('treeName' in details) setNameValue(oldTree.treeName);
        if ('ownerPersonId' in details) {
           setNodes((nds) =>
            nds.map((n) => ({ ...n, data: { ...n.data, isOwner: n.id === oldTree.ownerPersonId } }))
           );
        }

        toast({ variant: "destructive", title: "שגיאת עדכון", description: "לא ניתן היה לשמור את הגדרות העץ." });
        const permissionError = new FirestorePermissionError({
            path: treeRef.path,
            operation: 'update',
            requestResourceData: details
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, db, tree, treeId, toast, setNodes]);

  const handleEditPerson = useCallback((personId: string) => {
    const personToEdit = people.find(p => p.id === personId);
    if (personToEdit) {
      setSelectedPerson(personToEdit);
      setIsEditorOpen(true);
    }
  }, [people]);

  const handleOpenManualEventEditor = (event: Partial<ManualEvent> | null) => {
    setEditingManualEvent(event);
    setIsManualEventEditorOpen(true);
  };
  
  const handleSaveManualEvent = async (eventData: Omit<ManualEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'treeId'> & { id?: string }) => {
      if (!user || !db) return;
  
      const isEditing = 'id' in eventData;
  
      try {
          if (isEditing) {
              const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventData.id!);
              const { id, ...dataToUpdate} = eventData;
              await updateDoc(eventRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
              toast({ title: 'האירוע עודכן' });
          } else {
              const eventsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents');
              await addDoc(eventsRef, { 
                  ...eventData, 
                  userId: user.uid, 
                  treeId, 
                  createdAt: serverTimestamp(), 
                  updatedAt: serverTimestamp() 
              });
              toast({ title: 'האירוע נוצר' });
          }
          fetchData(); // Refetch all data to update the view
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
      if (!user || !db) return;
  
      try {
          const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventId);
          await deleteDoc(eventRef);
          toast({ title: 'האירוע נמחק' });
          fetchData();
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
        return <TimelineView people={people} relationships={relationships} edgeType={edgeType} />;
      case 'table':
        const isOwner = user?.uid === tree?.userId;
        return <TableView 
            data={people} 
            isOwner={isOwner}
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
      default:
        return null;
    }
  };


  if (isUserLoading || (isLoading && !error)) {
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
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          viewMode={viewMode}
          setViewMode={setViewMode}
          edgeType={edgeType}
          setEdgeType={setEdgeType}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAccount={() => setIsAccountModalOpen(true)}
          onToggleChat={() => setIsChatPanelOpen(prev => !prev)}
        />
        <main className="flex-1 relative overflow-hidden">
          {viewMode === 'tree' && (
            <div className="absolute top-4 right-4 z-10 rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm flex items-center gap-2">
              <h1 className="text-lg font-semibold">{tree?.treeName}</h1>
              <Popover
                open={isOwnerPopoverOpen}
                onOpenChange={setIsOwnerPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
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
                          onClick={() => handleUpdateTreeDetails({ ownerPersonId: person.id })}
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
        onClose={() => {
          handleRelModalClose();
          if (pendingDeleteId) setPendingDeleteId(null);
        }}
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
        <AlertDialogContent>
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
        <AlertDialogContent>
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
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              מחק
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TreePageClient({ treeId }: TreePageClientProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasContainer treeId={treeId} />
    </ReactFlowProvider>
  );
}
