'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection, OnConnect, OnNodeDragStop, OnEdgeDoubleClick, OnPaneClick, OnEdgeClick, OnNodeDoubleClick, IsValidConnection, NodeChange, OnSelectionChangeParams } from 'reactflow';
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useStore,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal, relationshipOptions } from './relationship-modal';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';


type TreePageClientProps = {
  treeId: string;
};

const getEdgeStyle = (selected = false) => ({
  strokeWidth: selected ? 2.5 : 1.5,
  stroke: selected ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
});

// This function now intelligently determines the correct source and target handles
// based on the LOGICAL relationship type, not the handles used to draw the initial line.
const getEdgeProps = (rel: Relationship, nodes: Node<Person>[]) => {
    const nodeA = nodes.find(n => n.id === rel.personAId);
    const nodeB = nodes.find(n => n.id === rel.personBId);

    if (!nodeA || !nodeB) {
        // Return a default if nodes are not found, to prevent crashes
        return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
    }

    const parentTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
    const spouseTypes = ['spouse', 'ex_spouse', 'separated', 'partner', 'ex_partner'];
    const siblingTypes = ['sibling', 'twin', 'step_sibling'];
    
    // For parent types, personA is ALWAYS the parent, personB is the child.
    if (parentTypes.includes(rel.relationshipType)) {
        return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
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
  
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => (s.past?.length ?? 0) > 0);
  const canRedo = useStore((s) => (s.future?.length ?? 0) > 0);

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);

  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [personToCreate, setPersonToCreate] = useState<any | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      setEdges((eds) =>
        eds.map((edge) => {
          // Animate edges if exactly one node is selected
          const isAnimated =
            selectedNodes.length === 1 &&
            (edge.source === selectedNodes[0].id ||
              edge.target === selectedNodes[0].id);

          // An edge is visually "selected" if it was clicked directly
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

      const treeSnap = await getDoc(treeDetailsRef);
      if (!treeSnap.exists()) {
        throw new Error("עץ המשפחה לא נמצא או שאין לך גישה.");
      }
      
      const [peopleSnap, relsSnap, posSnap] = await Promise.all([
          getDocs(peopleRef),
          getDocs(relsRef),
          getDocs(posRef)
      ]);

      const treeData = { id: treeSnap.id, ...treeSnap.data() } as FamilyTree;
      const peopleData = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() } as Person));
      const relsData = relsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Relationship));
      const posData = posSnap.docs.map(d => ({ id: d.id, ...d.data() } as CanvasPosition));

      setTree(treeData);
      setPeople(peopleData);
      setRelationships(relsData);

      const positionsMap = new Map(posData.map(p => [p.personId, { x: p.x, y: p.y }]));

      const initialNodes = peopleData.map(person => ({
          id: person.id,
          type: 'personNode',
          position: positionsMap.get(person.id) || { x: Math.random() * 400, y: Math.random() * 400 },
          data: { ...person, isOwner: person.id === treeData.ownerPersonId },
      }));
      setNodes(initialNodes);

      const relLabelMap = new Map(relationshipOptions.map(opt => [opt.type, opt.label]));
      // Fallback for types that might map to the same base type but have different labels in the modal
      relLabelMap.set('spouse', 'נשואים');
      relLabelMap.set('ex_spouse', 'גרושים');
      relLabelMap.set('separated', 'פרודים');
      relLabelMap.set('partner', 'בן/בת זוג');
      relLabelMap.set('ex_partner', 'בן/בת זוג לשעבר');
      
      const initialEdges = relsData.map(rel => {
          const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, initialNodes);
          const getLabel = () => {
              if (rel.relationshipType === 'parent' || rel.relationshipType === 'step_parent' || rel.relationshipType === 'adoptive_parent') {
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
            source,
            target,
            sourceHandle,
            targetHandle,
            type: 'bezier',
            label: getLabel(),
            labelBgStyle: { fill: 'hsl(var(--background))', padding: '2px 4px' },
            labelStyle: { fill: 'hsl(var(--foreground))' },
            data: rel,
            style: getEdgeStyle(false),
          };
      });
      setEdges(initialEdges);

    } catch (err: any) {
      console.error("Error fetching tree data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user, db, setNodes, setEdges]);

  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      fetchData();
    }
  }, [fetchData, isUserLoading, user]);

  const handleEdgeDoubleClick: OnEdgeDoubleClick = useCallback((_, edge) => {
    const rel = relationships.find(r => r.id === edge.id);
    if (rel) {
      setEditingRelationship(rel);
      setIsRelModalOpen(true);
    }
  }, [relationships]);

  const handleNodeDoubleClick: OnNodeDoubleClick = useCallback((_, node) => {
    setSelectedPerson(node.data);
    setIsEditorOpen(true);
  }, []);
  
  const handlePaneClick: OnPaneClick = useCallback(() => {
    setSelectedPerson(null);
    setEditingRelationship(null);
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    setEdges(eds => eds.map(e => ({ ...e, selected: false, animated: false, style: getEdgeStyle(false) })));
  }, [setNodes, setEdges]);


  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleOpenEditorForNew = () => {
    setSelectedPerson(null);
    setIsEditorOpen(true);
  }
  
  const proceedWithCreation = async (personData: any) => {
    if (!user || !db) return;
    setIsDuplicateAlertOpen(false);

    const data = { ...personData, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    try {
      const peopleCollection = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      const docRef = await addDoc(peopleCollection, data);
      const newPerson = { id: docRef.id, ...data };
      toast({ title: 'אדם נוסף', description: `${newPerson.firstName} ${newPerson.lastName} נוסף.` });
      fetchData();
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/familyTrees/${treeId}/people`, operation: 'create', requestResourceData: data });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'שגיאה', description: permissionError.message });
    }
    setPersonToCreate(null);
  }

  const handleSavePerson = async (personData: any) => {
    if (selectedPerson) {
      await handleUpdatePerson(personData as Person);
    } else {
      await handleCreatePerson(personData);
    }
  }

  const handleCreatePerson = async (personData: any) => {
    if (!user || !db) return;

    const duplicateQuery = query(
      collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'),
      where("firstName", "==", personData.firstName),
      where("lastName", "==", personData.lastName),
      where("birthDate", "==", personData.birthDate || null),
      limit(1)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);
    
    if(!duplicateSnapshot.empty) {
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
      const docRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personData.id);
      const dataToUpdate = { ...personData, updatedAt: serverTimestamp() };
      await updateDoc(docRef, dataToUpdate);
      toast({ title: 'אדם עודכן', description: `${personData.firstName} ${personData.lastName} עודכן.` });
      fetchData();
      handleEditorClose();
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/familyTrees/${treeId}/people/${personData.id}`, operation: 'update', requestResourceData: personData });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'שגיאה', description: permissionError.message });
    }
  };
  
  const handleDeleteRequest = (personId: string) => {
    const person = people.find(p => p.id === personId);
    if(person){
      setPersonToDelete(person);
      setIsEditorOpen(false);
      setIsDeleteAlertOpen(true);
    }
  }
  
  const handleConfirmDelete = async () => {
    if (!personToDelete || !user || !db) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(db);
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personToDelete.id);
        batch.delete(personRef);
        
        const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships');
        const relsQuery1 = query(relsRef, where('personAId', '==', personToDelete.id));
        const relsQuery2 = query(relsRef, where('personBId', '==', personToDelete.id));
        
        const [rels1Snapshot, rels2Snapshot] = await Promise.all([getDocs(relsQuery1), getDocs(relsQuery2)]);
        rels1Snapshot.forEach(doc => batch.delete(doc.ref));
        rels2Snapshot.forEach(doc => batch.delete(doc.ref));

        const posRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
        const posQuery = query(posRef, where('personId', '==', personToDelete.id), limit(1));
        const posSnapshot = await getDocs(posQuery);
        if (!posSnapshot.empty) {
            batch.delete(posSnapshot.docs[0].ref);
        }

        await batch.commit();
        toast({ title: 'אדם נמחק', description: `${personToDelete.firstName} ${personToDelete.lastName} נמחק מהעץ.`});
        fetchData();
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/familyTrees/${treeId}/people/${personToDelete.id}`,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'שגיאת מחיקה', description: "Failed to delete person and their relationships." });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
      setPersonToDelete(null);
    }
  }


  const handleConnect: OnConnect = useCallback((params) => {
    setNewConnection(params);
    setIsRelModalOpen(true);
  }, []);

  const handleRelModalClose = () => {
    setIsRelModalOpen(false);
    setNewConnection(null);
    setEditingRelationship(null);
  }

  const handleSaveRelationship = async (payload: { relData: any, genderUpdate?: { personId: string, gender: 'male' | 'female' | 'other' }}) => {
    if (!user || !db) return;
  
    const { relData, genderUpdate } = payload;
  
    try {
      const batch = writeBatch(db);
  
      if (editingRelationship) {
        // Update existing relationship
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', editingRelationship.id);
        const dataToUpdate = { ...relData, updatedAt: serverTimestamp() };
        batch.update(relRef, dataToUpdate);
      } else {
        // Create new relationship
        const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships');
        const newDocRef = doc(relsRef);
        const dataToCreate = {
            ...relData,
            userId: user.uid,
            treeId: treeId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        batch.set(newDocRef, dataToCreate);
      }
  
      if (genderUpdate) {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', genderUpdate.personId);
        batch.update(personRef, { gender: genderUpdate.gender });
      }
  
      await batch.commit();
  
      toast({ title: editingRelationship ? 'קשר עודכן' : 'קשר נוסף' });
  
      fetchData();
      handleRelModalClose();
  
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת קשר',
        description: error.message || "An unexpected error occurred.",
      });
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/relationships`,
        operation: editingRelationship ? 'update' : 'create',
        requestResourceData: relData,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!user || !db) return;
  
    let edgeToDelete: any;
    setEdges(currentEdges => {
      edgeToDelete = currentEdges.find(e => e.id === relationshipId);
      return currentEdges.filter(e => e.id !== relationshipId);
    });
  
    try {
      const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relationshipId);
      await deleteDoc(relRef);
      setRelationships(rels => rels.filter(r => r.id !== relationshipId));
      toast({ title: 'קשר נמחק' });
    } catch (error: any) {
      console.error('Error deleting relationship:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה במחיקת קשר',
        description: "לא ניתן היה למחוק את הקשר. החיבור שוחזר.",
      });
      if (edgeToDelete) {
        setEdges(currentEdges => [...currentEdges, edgeToDelete!]);
      }
      const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/familyTrees/${treeId}/relationships/${relationshipId}`, operation: 'delete' });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      handleRelModalClose();
    }
  };

  const handleNodeDragStop: OnNodeDragStop = useCallback(async (_, node) => {
    if (!user || !db) return;
    
    const posData = { personId: node.id, x: node.position.x, y: node.position.y };
    try {
      const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
      const q = query(canvasPositionsRef,
        where("personId", "==", posData.personId),
        limit(1)
      );
      const snapshot = await getDocs(q);

      const dataToSave = {
        ...posData,
        userId: user.uid,
        treeId,
        updatedAt: serverTimestamp()
      };

      if (snapshot.empty) {
        await addDoc(canvasPositionsRef, dataToSave);
      } else {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { x: posData.x, y: posData.y, updatedAt: serverTimestamp() });
      }
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/familyTrees/${treeId}/canvasPositions`, operation: 'write', requestResourceData: posData });
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, treeId, db]);

  const isValidConnection = useCallback<IsValidConnection>((connection) => {
    // Basic validation: prevent self-connections
    if (connection.source === connection.target) {
        return false;
    }
    const sideHandles = ['upper-left-source', 'upper-left-target', 'upper-right-source', 'upper-right-target', 'lower-left-source', 'lower-left-target', 'lower-right-source', 'lower-right-target'];
    
    // Allow connections between any two side handles
    if (sideHandles.includes(connection.sourceHandle!) && sideHandles.includes(connection.targetHandle!)) {
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

  const handleRenameTree = async () => {
    if (!user || !db || !tree || nameValue === tree.treeName || !nameValue.trim()) {
        setIsEditingName(false);
        return;
    }

    const newName = nameValue.trim();
    const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
    
    setTree(prev => prev ? { ...prev, treeName: newName } : null);
    setIsEditingName(false);

    try {
        await updateDoc(treeRef, { treeName: newName });
        toast({ title: "השם עודכן" });
    } catch (error: any) {
        setTree(prev => prev ? { ...prev, treeName: tree.treeName } : null);
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את שם העץ.' });
        const permissionError = new FirestorePermissionError({ path: treeRef.path, operation: 'update', requestResourceData: { treeName: newName } });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleSetOwner = async (personId: string) => {
    if (!user || !db || !tree || personId === tree.ownerPersonId) {
        setIsOwnerPopoverOpen(false);
        return;
    }
    
    const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
    const oldOwnerId = tree.ownerPersonId;

    setTree(prev => prev ? { ...prev, ownerPersonId: personId } : null);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isOwner: n.id === personId } })));
    setIsOwnerPopoverOpen(false);

    try {
        await updateDoc(treeRef, { ownerPersonId: personId });
        toast({ title: 'המשתמש הוגדר' });
    } catch (error: any) {
        setTree(prev => prev ? { ...prev, ownerPersonId: oldOwnerId } : null);
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isOwner: n.id === oldOwnerId } })));
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה להגדיר את המשתמש.' });
        const permissionError = new FirestorePermissionError({ path: treeRef.path, operation: 'update', requestResourceData: { ownerPersonId: personId } });
        errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  if (isUserLoading || (isLoading && !error)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className='text-muted-foreground'>טוען את עץ המשפחה שלך...</p>
      </div>
    );
  }
  
  if (!isUserLoading && (!user || user.isAnonymous)) {
     return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying access...</p>
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
    <div className="h-screen w-full overflow-hidden">
        <div className="flex h-full">
            <CanvasToolbar
                onAddPerson={handleOpenEditorForNew}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
            />
            <main className="flex-1 relative">
                <div className="absolute top-4 left-4 z-10 rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm flex items-center gap-2">
                    {!isEditingName ? (
                        <h1
                            className="text-lg font-semibold cursor-pointer"
                            onDoubleClick={() => {
                                if(tree) {
                                    setNameValue(tree.treeName);
                                    setIsEditingName(true);
                                }
                            }}
                        >
                            {tree?.treeName ?? 'עץ משפחה'}
                        </h1>
                    ) : (
                        <Input
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameTree();
                                if (e.key === 'Escape') setIsEditingName(false);
                            }}
                            onBlur={handleRenameTree}
                            autoFocus
                            className="text-lg h-8"
                        />
                    )}
                    <Popover open={isOwnerPopoverOpen} onOpenChange={setIsOwnerPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <User className="h-4 w-4" />
                                <span className="sr-only">בחר אותי</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0">
                            <h4 className="text-sm font-medium p-2 border-b text-center">מי אתה בעץ?</h4>
                            <ScrollArea className="h-72">
                                <div className="p-2 space-y-1">
                                {people.map(person => (
                                    <Button
                                        key={person.id}
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={() => handleSetOwner(person.id)}
                                    >
                                        {person.firstName} {person.lastName}
                                    </Button>
                                ))}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>
                <FamilyTreeCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onPaneClick={handlePaneClick}
                    onNodeDragStop={handleNodeDragStop}
                    onConnect={handleConnect}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    isValidConnection={isValidConnection}
                    onSelectionChange={onSelectionChange}
                />
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
                (pendingDeleteId ? relationships.find(r => r.id === pendingDeleteId) : null)
            }
            relationshipId={
                editingRelationship?.id || pendingDeleteId || undefined
            }
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
        <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>נמצאה כפילות אפשרית</AlertDialogTitle>
            <AlertDialogDescription>
                אדם עם שם ותאריך לידה דומים כבר קיים בעץ זה. האם אתה עדיין רוצה ליצור את האדם החדש הזה?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPersonToCreate(null)}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => personToCreate && proceedWithCreation(personToCreate)}>צור בכל זאת</AlertDialogAction>
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
                    <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
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
