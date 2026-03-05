'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection } from 'reactflow';
import { ReactFlowProvider } from 'reactflow';

import { useUser, useFirestore } from '@/firebase';
import type { FamilyTree, Person, Relationship } from '@/lib/types';
import {
  getTreeDetails,
  getPeople,
  getRelationships,
  getCanvasPositions,
  addPerson,
  updatePerson,
  addRelationship,
  updateCanvasPosition,
  checkForDuplicate,
} from '@/lib/actions/trees';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal } from './relationship-modal';
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

export function TreeClient({ treeId }: { treeId: string }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);

  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [personToCreate, setPersonToCreate] = useState<any | null>(null);

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

      setNodes(
        peopleData.map(person => ({
          id: person.id,
          type: 'personNode',
          position: positionsMap.get(person.id) || { x: Math.random() * 400, y: Math.random() * 400 },
          data: person,
        }))
      );

      setEdges(
        relsData.map(rel => ({
          id: rel.id,
          source: rel.personAId,
          target: rel.personBId,
          label: rel.relationshipType.replace('_', ' ').charAt(0).toUpperCase() + rel.relationshipType.replace('_', ' ').slice(1),
          type: 'smoothstep',
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user, db]);

  useEffect(() => {
    if (!isUserLoading) {
      fetchData();
    }
  }, [fetchData, isUserLoading]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedPerson(node.data);
    setIsEditorOpen(true);
  }, []);

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleCreatePerson = async (personData: any) => {
    if (!user) return;
    const isDuplicate = await checkForDuplicate(db, {personData, userId: user.uid, treeId});
    if(isDuplicate) {
        setPersonToCreate(personData);
        setIsDuplicateAlertOpen(true);
        return;
    }
    await proceedWithCreation(personData);
  };

  const proceedWithCreation = async (personData: any) => {
    if (!user) return;
    const result = await addPerson(db, {personData, userId: user.uid, treeId});
    if (result.success && result.data) {
        toast({ title: 'אדם נוסף', description: `${result.data.firstName} ${result.data.lastName} נוסף.` });
        fetchData();
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
    setPersonToCreate(null);
  }

  const handleUpdatePerson = async (personData: Person) => {
    if (!user) return;
    const result = await updatePerson(db, {personData, userId: user.uid, treeId});
     if (result.success && result.data) {
        toast({ title: 'אדם עודכן', description: `${result.data.firstName} ${result.data.lastName} עודכן.` });
        fetchData();
        handleEditorClose();
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
  };

  const handleConnect = useCallback((params: Connection) => {
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
        fetchData();
        handleRelModalClose();
    } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
    }
  }

  const handleNodeDragStop = async (_: React.MouseEvent, node: Node) => {
    if (!user) return;
    await updateCanvasPosition(db, { posData: { personId: node.id, x: node.position.x, y: node.position.y }, userId: user.uid, treeId });
  };
  
  if (isLoading || isUserLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className='text-muted-foreground'>טוען את עץ המשפחה שלך...</p>
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
    <ReactFlowProvider>
      <FamilyTreeCanvas
        treeName={tree?.treeName ?? 'עץ משפחה'}
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onCreatePerson={handleCreatePerson}
      />
      <PersonEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        person={selectedPerson}
        treeId={treeId}
        onSave={selectedPerson ? handleUpdatePerson : handleCreatePerson}
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
    </ReactFlowProvider>
  );
}
