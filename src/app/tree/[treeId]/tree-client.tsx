'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge, Connection } from 'reactflow';
import { ReactFlowProvider } from 'reactflow';

import { useUser } from '@/firebase';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '@/lib/types';
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
  const { user } = useUser();
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
  const [personToCreate, setPersonToCreate] = useState<Omit<Person, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [treeData, peopleData, relsData, posData] = await Promise.all([
        getTreeDetails(treeId),
        getPeople(treeId),
        getRelationships(treeId),
        getCanvasPositions(treeId),
      ]);

      if (!treeData) {
        throw new Error("Family tree not found or you don't have access.");
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
          source: rel.personA,
          target: rel.personB,
          label: rel.relationshipType.replace('_', ' ').charAt(0).toUpperCase() + rel.relationshipType.replace('_', ' ').slice(1),
          type: 'smoothstep',
        }))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedPerson(node.data);
    setIsEditorOpen(true);
  }, []);

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleCreatePerson = async (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    const isDuplicate = await checkForDuplicate(personData);
    if(isDuplicate) {
        setPersonToCreate(personData);
        setIsDuplicateAlertOpen(true);
        return;
    }
    await proceedWithCreation(personData);
  };

  const proceedWithCreation = async (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await addPerson(personData);
    if (result.success && result.data) {
        toast({ title: 'Person Added', description: `${result.data.firstName} ${result.data.lastName} has been added.` });
        fetchData();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setPersonToCreate(null);
  }

  const handleUpdatePerson = async (personData: Person) => {
    const result = await updatePerson(personData);
     if (result.success && result.data) {
        toast({ title: 'Person Updated', description: `${result.data.firstName} ${result.data.lastName} has been updated.` });
        fetchData();
        handleEditorClose();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
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

  const handleCreateRelationship = async (relData: Omit<Relationship, 'id' | 'treeId'>) => {
    const result = await addRelationship({ ...relData, treeId });
    if (result.success && result.data) {
        toast({ title: 'Relationship Added'});
        fetchData();
        handleRelModalClose();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }

  const handleNodeDragStop = async (_: React.MouseEvent, node: Node) => {
    await updateCanvasPosition({ treeId, personId: node.id, x: node.position.x, y: node.position.y });
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className='text-muted-foreground'>Loading your family tree...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-center text-destructive">
        <div>
          <h2 className="text-2xl font-bold">An Error Occurred</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas
        treeName={tree?.treeName ?? 'Family Tree'}
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
            <AlertDialogTitle>Potential Duplicate Found</AlertDialogTitle>
            <AlertDialogDescription>
              A person with a similar name and birth date already exists in this tree. Do you still want to create this new person?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPersonToCreate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => personToCreate && proceedWithCreation(personToCreate)}>Create Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReactFlowProvider>
  );
}
