'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection, OnConnect, OnNodeDragStop, OnNodeClick, OnEdgeDoubleClick } from 'reactflow';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal } from './relationship-modal';
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
      
      const peopleSnap = await getDocs(peopleRef);
      const relsSnap = await getDocs(relsRef);
      const posSnap = await getDocs(posRef);

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

      const initialEdges = relsData.map(rel => ({
          id: rel.id,
          source: rel.personAId,
          target: rel.personBId,
          label: rel.relationshipType.replace('_', ' ').charAt(0).toUpperCase() + rel.relationshipType.replace('_', ' ').slice(1),
          type: 'smoothstep',
          data: rel,
      }));
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

  const handleNodeClick: OnNodeClick = useCallback((_, node) => {
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
            const dataToCreate = { ...cleanedData, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
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
    
    try {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relationshipId);
        await deleteDoc(relRef);
        
        toast({ title: 'קשר נמחק' });
        fetchData();
        handleRelModalClose();
        
    } catch (error: any) {
        console.error('Error deleting relationship:', error);
        toast({
            variant: 'destructive',
            title: 'שגיאה במחיקת קשר',
            description: error.message || "Could not delete relationship.",
        });
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
                    onNodeDragStop={handleNodeDragStop}
                    onConnect={handleConnect}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                />
            </main>
          </div>

          <PersonEditor
            isOpen={isEditorOpen}
            onClose={handleEditorClose}
            person={selectedPerson}
            treeId={treeId}
            onSave={handleSavePerson}
            onDelete={handleDeleteRequest}
          />
          {(newConnection || editingRelationship) && (
            <RelationshipModal
                isOpen={isRelModalOpen}
                onClose={handleRelModalClose}
                connection={newConnection}
                relationship={editingRelationship}
                people={people}
                onSave={handleSaveRelationship}
                onDelete={handleDeleteRelationship}
            />
          )}
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
