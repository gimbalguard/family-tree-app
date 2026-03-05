'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection, OnConnect, OnNodeDragStop, OnNodeClick } from 'reactflow';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { FamilyTree, Person, Relationship } from '@/lib/types';
import {
  getTreeDetails,
  getPeople,
  getRelationships,
  getCanvasPositions,
  addPerson,
  updatePerson,
  deletePerson,
  addRelationship,
  updateCanvasPosition,
  checkForDuplicate,
} from '@/lib/actions/trees';
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
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
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
    if (!user || user.isAnonymous) return;
    setIsLoading(true);
    setError(null);
    try {
      const [treeData, peopleData, relsData, posData] = await Promise.all([
        getTreeDetails(db, user.uid, treeId),
        getPeople(db, user.uid, treeId),
        getRelationships(db, user.uid, treeId),
        getCanvasPositions(db, user.uid, treeId),
      ]);

      if (!treeData) {
        throw new Error("עץ המשפחה לא נמצא או שאין לך גישה.");
      }

      setTree(treeData);
      setPeople(peopleData);

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
      }));
      setEdges(initialEdges);

    } catch (err: any) {
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
    if (!user || user.isAnonymous) return;
    setIsDuplicateAlertOpen(false);
    const result = await addPerson(db, {personData, userId: user.uid, treeId});
    if (result.success && result.data) {
        toast({ title: 'אדם נוסף', description: `${result.data.firstName} ${result.data.lastName} נוסף.` });
        fetchData(); // Full refetch to get new person on canvas
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
    setPersonToCreate(null);
  }

  const handleSavePerson = async (personData: any) => {
    if (selectedPerson) { // It's an update
      await handleUpdatePerson(personData as Person);
    } else { // It's a creation
      await handleCreatePerson(personData);
    }
  }

  const handleCreatePerson = async (personData: any) => {
    if (!user) return;
    const isDuplicate = await checkForDuplicate(db, {personData, userId: user.uid, treeId});
    if(isDuplicate) {
        setPersonToCreate(personData);
        setIsDuplicateAlertOpen(true);
    } else {
        await proceedWithCreation(personData);
        handleEditorClose();
    }
  };

  const handleUpdatePerson = async (personData: Person) => {
    if (!user) return;
    const result = await updatePerson(db, {personData, userId: user.uid, treeId});
     if (result.success && result.data) {
        toast({ title: 'אדם עודכן', description: `${result.data.firstName} ${result.data.lastName} עודכן.` });
        fetchData(); // Refetch to update all nodes/edges
        handleEditorClose();
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
  };
  
  const handleDeleteRequest = (personId: string) => {
    const person = people.find(p => p.id === personId);
    if(person){
      setPersonToDelete(person);
      setIsEditorOpen(false); // Close the editor first
      setIsDeleteAlertOpen(true);
    }
  }
  
  const handleConfirmDelete = async () => {
    if (!personToDelete || !user) return;
    setIsDeleting(true);
    const result = await deletePerson(db, { userId: user.uid, treeId, personId: personToDelete.id });
    if(result.success) {
      toast({ title: 'אדם נמחק', description: `${personToDelete.firstName} ${personToDelete.lastName} נמחק מהעץ.`});
      fetchData(); // Refetch everything
    } else {
      toast({ variant: 'destructive', title: 'שגיאת מחיקה', description: result.error });
    }
    setIsDeleting(false);
    setIsDeleteAlertOpen(false);
    setPersonToDelete(null);
  }


  const handleConnect: OnConnect = useCallback((params) => {
    setNewConnection(params);
    setIsRelModalOpen(true);
  }, []);

  const handleRelModalClose = () => {
    setIsRelModalOpen(false);
    setNewConnection(null);
  }

  const handleCreateRelationship = async (relData: Omit<Relationship, 'id' | 'treeId' | 'userId'>) => {
    if (!user) return;
    const result = await addRelationship(db, { relData, userId: user.uid, treeId });
    if (result.success && result.data) {
        toast({ title: 'קשר נוסף'});
        const newEdge = {
            id: result.data.id,
            source: result.data.personAId,
            target: result.data.personBId,
            label: result.data.relationshipType,
            type: 'smoothstep',
        };
        setEdges((eds) => eds.concat(newEdge));
        handleRelModalClose();
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
  }

  const handleNodeDragStop: OnNodeDragStop = useCallback(async (_, node) => {
    if (!user) return;
    await updateCanvasPosition(db, { posData: { personId: node.id, x: node.position.x, y: node.position.y }, userId: user.uid, treeId });
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
          {newConnection && (
            <RelationshipModal
                isOpen={isRelModalOpen}
                onClose={handleRelModalClose}
                connection={newConnection}
                people={people}
                onSave={handleCreateRelationship}
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
