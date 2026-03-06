'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection, OnConnect, OnNodeDragStop, OnNodeClick, OnEdgeDoubleClick, OnPaneClick, OnEdgeClick, OnNodeDoubleClick, IsValidConnection } from 'reactflow';
import { ReactFlowProvider, useNodesState, useEdgesState, ConnectionMode } from 'reactflow';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal, relationshipOptions } from './relationship-modal';
import { CanvasToolbar } from './canvas-toolbar';
import { Loader2 } from 'lucide-react';
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


export function TreePageClient({ treeId }: TreePageClientProps) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

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
          data: person,
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

  const handleNodeClick: OnNodeClick = useCallback((_, clickedNode) => {
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === clickedNode.id })));
    setEdges(eds => {
        const connectedEdgeIds = new Set(eds.filter(e => e.source === clickedNode.id || e.target === clickedNode.id).map(e => e.id));
        return eds.map(e => {
            const isSelected = connectedEdgeIds.has(e.id);
            return { ...e, selected: isSelected, animated: isSelected, style: getEdgeStyle(isSelected) };
        });
    });
  }, [setNodes, setEdges]);

  const handleEdgeClick: OnEdgeClick = useCallback((_, clickedEdge) => {
    setEdges(eds => eds.map(e => {
        const isSelected = e.id === clickedEdge.id;
        return { ...e, selected: isSelected, animated: isSelected, style: getEdgeStyle(isSelected) };
    }));
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === clickedEdge.source || n.id === clickedEdge.target })));
  }, [setNodes, setEdges]);
  
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
    
    const cleanedData = Object.fromEntries(
      Object.entries(relData).filter(([, v]) => v !== undefined)
    );

    try {
        const batch = writeBatch(db);
        
        if (editingRelationship) {
            const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', editingRelationship.id);
            const dataToUpdate = { ...cleanedData, userId: user.uid, treeId, updatedAt: serverTimestamp() };
            batch.update(relRef, dataToUpdate);
        } else {
            const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships');
            const newDocRef = doc(relsRef);
            relData.id = newDocRef.id;
            const dataToCreate = { ...cleanedData, id: newDocRef.id, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
            batch.set(newDocRef, dataToCreate);
        }

        if (genderUpdate) {
            const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', genderUpdate.personId);
            batch.update(personRef, { gender: genderUpdate.gender });
        }

        await batch.commit();

        toast({ title: editingRelationship ? 'קשר עודכן' : 'קשר נוסף' });
        
        // This is the correct way: refetch all data to ensure UI consistency after a complex change.
        fetchData(); 
        handleRelModalClose();

    } catch (error: any) {
        console.error('Real error:', error);
        toast({
          variant: 'destructive',
          title: 'שגיאה בשמירת קשר',
          description: error.message || "An unexpected error occurred.",
        });
        throw error;
    }
  };
  
  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!user || !db) return;
  
    let edgeToDelete: Edge | undefined;
  
    // Use functional update to get current edges and find the edge atomically
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
      toast({ variant: 'destructive', title: 'שגיאה במחיקת קשר' });
      if (edgeToDelete) {
        setEdges(currentEdges => [...currentEdges, edgeToDelete!]);
      }
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
        <ReactFlowProvider>
          <div className="flex h-full">
            <CanvasToolbar onAddPerson={handleOpenEditorForNew} />
            <main className="flex-1 relative">
                <div className="absolute top-4 left-4 z-10 rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm">
                    <h1 className="text-lg font-semibold">{tree?.treeName ?? 'עץ משפחה'}</h1>
                </div>
                <FamilyTreeCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onEdgeClick={handleEdgeClick}
                    onPaneClick={handlePaneClick}
                    onNodeDragStop={handleNodeDragStop}
                    onConnect={handleConnect}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    isValidConnection={isValidConnection}
                />
            </main>
          </div>

          <RelationshipModal
              isOpen={isRelModalOpen}
              onClose={handleRelModalClose}
              connection={newConnection}
              relationship={editingRelationship}
              relationshipId={editingRelationship?.id}
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
        </ReactFlowProvider>
    </div>
  );
}
