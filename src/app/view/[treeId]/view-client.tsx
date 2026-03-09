'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Node, Edge } from 'reactflow';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '@/lib/types';
import { FamilyTreeCanvas } from '@/app/tree/[treeId]/family-tree-canvas';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/icons';
import { getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';

// Simplified version of getEdgeProps from tree-page-client
const getEdgeProps = (rel: Relationship, nodes: Node<Person>[]) => {
  const nodeA = nodes.find((n) => n.id === rel.personAId);
  const nodeB = nodes.find((n) => n.id === rel.personBId);
  if (!nodeA || !nodeB) return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
  const parentTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
  if (parentTypes.includes(rel.relationshipType)) return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
  const isNodeALeft = nodeA.position.x < nodeB.position.x;
  const sourceId = isNodeALeft ? rel.personAId : rel.personBId;
  const targetId = isNodeALeft ? rel.personBId : rel.personAId;
  const spouseTypes = ['spouse', 'ex_spouse', 'separated', 'partner', 'ex_partner'];
  if (spouseTypes.includes(rel.relationshipType)) return { source: sourceId, target: targetId, sourceHandle: 'upper-right-source', targetHandle: 'upper-left-source' };
  return { source: sourceId, target: targetId, sourceHandle: 'lower-right-source', targetHandle: 'lower-left-source' };
};

function ViewCanvasContainer({ treeId }: { treeId: string }) {
  const db = useFirestore();
  const router = useRouter();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setViewport } = useReactFlow();

  const deriveStateFromData = useCallback((
    peopleData: Person[], 
    relsData: Relationship[], 
    posData: CanvasPosition[],
    currentTree: FamilyTree
  ) => {
    // This is a simplified version from tree-page-client, no need for creator/twin logic here
    const positionsMap = new Map<string, Partial<CanvasPosition>>(posData.map(p => [p.personId, p]));
    const newNodes = peopleData.map(person => {
      const pos = positionsMap.get(person.id);
      return {
        id: person.id,
        type: 'personNode',
        position: pos ? { x: pos.x, y: pos.y } : { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          ...person,
          isLocked: true, // Lock all nodes in view-only mode
          cardDesign: currentTree.cardDesign,
          cardBackgroundColor: currentTree.cardBackgroundColor,
          cardBorderColor: currentTree.cardBorderColor,
          cardBorderWidth: currentTree.cardBorderWidth,
        },
        draggable: false, // Not draggable
      };
    });
    setNodes(newNodes);

    const newEdges = relsData.map(rel => {
      const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, newNodes);
      return {
        id: rel.id, source, target, sourceHandle, targetHandle, type: 'default',
        label: '', data: rel, className: 'custom-edge',
      };
    });
    setEdges(newEdges);

    if (newNodes.length > 0) {
      setTimeout(() => {
        // use fitView instead of setViewport for better initial view
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ padding: 0.1, duration: 800 });
        } else {
           setViewport({ x: 0, y: 0, zoom: 0.75 }, { duration: 800 })
        }
      }, 100);
    }
  }, [setViewport]);

  const fetchData = useCallback(async () => {
    if (!db) return;
    setIsLoading(true);
    setError(null);
    try {
      const publicTreeRef = doc(db, 'publicTrees', treeId);
      const publicTreeSnap = await getDoc(publicTreeRef);

      if (!publicTreeSnap.exists()) {
        throw new Error('This tree is not public or does not exist.');
      }

      const ownerUserId = publicTreeSnap.data().ownerUserId;
      if (!ownerUserId) {
        throw new Error('Tree data is incomplete.');
      }

      const treeDetailsRef = doc(db, 'users', ownerUserId, 'familyTrees', treeId);
      const peopleRef = collection(db, 'users', ownerUserId, 'familyTrees', treeId, 'people');
      const relsRef = collection(db, 'users', ownerUserId, 'familyTrees', treeId, 'relationships');
      const posRef = collection(db, 'users', ownerUserId, 'familyTrees', treeId, 'canvasPositions');

      const treeSnap = await getDoc(treeDetailsRef);
      if (!treeSnap.exists()) {
        throw new Error('The original tree could not be found.');
      }

      const [peopleSnap, relsSnap, posSnap] = await Promise.all([
        getDocs(peopleRef),
        getDocs(relsRef),
        getDocs(posRef),
      ]);

      const treeData = { id: treeSnap.id, ...treeSnap.data() } as FamilyTree;
      const peopleData = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
      const relsData = relsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship));
      const posData = posSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CanvasPosition));
      
      setTree(treeData);
      deriveStateFromData(peopleData, relsData, posData, treeData);
      
    } catch (err: any) {
      console.error('Error fetching public tree data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, db, deriveStateFromData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">טוען את עץ המשפחה...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-center text-destructive">
        <div>
          <h2 className="text-2xl font-bold">אירעה שגיאה</h2>
          <p>{error}</p>
          <Button onClick={() => router.push('/')} className="mt-4">חזור לדף הבית</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col" style={{ backgroundColor: tree?.canvasBackgroundColor }}>
      <AppHeader />
      <main className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10">
            <Button onClick={() => router.back()}>
                <ArrowLeft className="ml-2" />
                חזרה
            </Button>
        </div>
        <FamilyTreeCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          onConnect={() => {}}
          onNodeDragStart={() => {}}
          onNodeDrag={() => {}}
          onNodeDragStop={() => {}}
          onNodeContextMenu={(e) => e.preventDefault()}
          isValidConnection={() => false}
          onSelectionChange={() => {}}
        />
      </main>
    </div>
  );
}

export function ViewPageClient({ treeId }: { treeId: string }) {
  return (
    <ReactFlowProvider>
      <ViewCanvasContainer treeId={treeId} />
    </ReactFlowProvider>
  );
}
