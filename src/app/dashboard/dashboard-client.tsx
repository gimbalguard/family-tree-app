'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import type { FamilyTree, SharedTree, PublicTree } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Users, LogIn, Share2, Globe, Copy, Link as LinkIcon, Edit } from 'lucide-react';
import { NewTreeDialog } from './new-tree-dialog';
import { TreeCard, TreeCardSkeleton } from './tree-card';
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
import { ShareTreeDialog } from './share-tree-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, writeBatch, doc, addDoc, getDoc, updateDoc, where, collectionGroup, limit, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { v4 as uuidv4 } from 'uuid';

export function DashboardClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [myTrees, setMyTrees] = useState<FamilyTree[]>([]);
  const [sharedTrees, setSharedTrees] = useState<(SharedTree & { ownerUsername?: string })[]>([]);
  const [publicTrees, setPublicTrees] = useState<PublicTree[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [treeToShare, setTreeToShare] = useState<FamilyTree | null>(null);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<FamilyTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAnonymous = user?.isAnonymous ?? true;

  const fetchTrees = useCallback(async () => {
    if (!user || user.isAnonymous || !db) return;

    setIsLoading(true);
    try {
      // Fetch My Trees with counts
      const myTreesRef = collection(db, 'users', user.uid, 'familyTrees');
      const myTreesSnapshot = await getDocs(myTreesRef);
      const myTreesPromises = myTreesSnapshot.docs.map(async (treeDoc) => {
        const treeData = { id: treeDoc.id, ...treeDoc.data() } as FamilyTree;
        const peopleRef = collection(treeDoc.ref, 'people');
        const relsRef = collection(treeDoc.ref, 'relationships');
        const [peopleSnap, relsSnap] = await Promise.all([
            getDocs(query(peopleRef, limit(1000))), // Assuming max 1000 people for count
            getDocs(query(relsRef, limit(1000))),
        ]);
        treeData.personCount = peopleSnap.size;
        treeData.relationshipCount = relsSnap.size;
        return treeData;
      });
      const userTrees = await Promise.all(myTreesPromises);
      setMyTrees(userTrees);

      // Fetch Shared Trees
      const sharedQuery = query(collection(db, "sharedTrees"), where("sharedWithUserId", "==", user.uid));
      const sharedSnapshot = await getDocs(sharedQuery);
      const sharedTreesDataPromises = sharedSnapshot.docs.map(async (doc) => {
        const share = doc.data() as SharedTree;
        const ownerSnap = await getDoc(collection(db, 'users', share.ownerUserId));
        return { ...share, ownerUsername: ownerSnap.exists() ? ownerSnap.data().username : 'Unknown Owner' };
      });
      const sharedTreesData = await Promise.all(sharedTreesDataPromises);
      setSharedTrees(sharedTreesData);
      
      // Fetch Public Trees
      const publicQuery = query(collection(db, "publicTrees"), limit(20));
      const publicSnapshot = await getDocs(publicQuery);
      const publicTreesData = publicSnapshot.docs.map(d => d.data() as PublicTree);
      setPublicTrees(publicTreesData);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
    }
    setIsLoading(false);
  }, [user, db, toast]);


  useEffect(() => {
    if (!isUserLoading && !isAnonymous) {
      fetchTrees();
    } else if (!isUserLoading && isAnonymous) {
      setIsLoading(false);
    }
  }, [isUserLoading, isAnonymous, fetchTrees]);

  const onTreeCreated = (newTree: FamilyTree) => {
    router.push(`/tree/${newTree.id}`);
  };

  const handleDuplicateTree = async (treeToDuplicate: FamilyTree) => {
    if (!user || !db) return;
    toast({ title: 'משכפל עץ, אנא המתן...' });

    try {
      const newTreeRef = doc(collection(db, 'users', user.uid, 'familyTrees'));
      const batch = writeBatch(db);

      // 1. Duplicate tree doc
      const newTreeData: Partial<FamilyTree> = {
        ...treeToDuplicate,
        id: newTreeRef.id,
        treeName: `${treeToDuplicate.treeName} - עותק`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      delete newTreeData.id;
      batch.set(newTreeRef, newTreeData);

      // 2. Read all subcollections
      const peopleRef = collection(db, 'users', user.uid, 'familyTrees', treeToDuplicate.id, 'people');
      const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeToDuplicate.id, 'relationships');
      const posRef = collection(db, 'users', user.uid, 'familyTrees', treeToDuplicate.id, 'canvasPositions');
      
      const [peopleSnap, relsSnap, posSnap] = await Promise.all([ getDocs(peopleRef), getDocs(relsRef), getDocs(posRef) ]);
      
      // 3. Write subcollections to new tree
      peopleSnap.forEach(d => batch.set(doc(collection(newTreeRef, 'people')), d.data()));
      relsSnap.forEach(d => batch.set(doc(collection(newTreeRef, 'relationships')), d.data()));
      posSnap.forEach(d => batch.set(doc(collection(newTreeRef, 'canvasPositions')), d.data()));

      await batch.commit();
      toast({ title: 'העץ שוכפל בהצלחה!' });
      fetchTrees();

    } catch (error) {
      console.error("Error duplicating tree:", error);
      toast({ variant: 'destructive', title: 'שגיאה בשכפול העץ' });
    }
  };

  const handleOpenShareDialog = (tree: FamilyTree) => {
    setTreeToShare(tree);
    setIsShareDialogOpen(true);
  };
  
  const handleShareSubmit = async (email: string) => {
    if (!treeToShare || !user || !db) return;
    try {
      const emailQuery = query(collection(db, "userEmails"), where("email", "==", email), limit(1));
      const emailSnap = await getDocs(emailQuery);

      if (emailSnap.empty) {
        toast({ variant: 'destructive', title: 'משתמש לא נמצא', description: 'לא נמצא משתמש עם כתובת האימייל שהוזנה.' });
        return;
      }
      
      const targetUser = emailSnap.docs[0].data();
      const sharedDocData = {
        ownerUserId: user.uid,
        ownerName: user.displayName || 'Unknown',
        treeId: treeToShare.id,
        treeName: treeToShare.treeName,
        sharedWithEmail: email,
        sharedWithUserId: targetUser.uid,
        canEdit: true,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, "sharedTrees"), sharedDocData);
      
      toast({ title: 'העץ שותף בהצלחה', description: `העץ "${treeToShare.treeName}" שותף עם ${email}.` });
      setIsShareDialogOpen(false);
      setTreeToShare(null);
    } catch (error) {
        console.error("Error sharing tree:", error);
        toast({ variant: 'destructive', title: 'שגיאה בשיתוף' });
    }
  }

  const handleCreateShareLink = async (tree: FamilyTree) => {
    if (!user || !db) return;
    try {
      let token = tree.shareToken;
      if (!token) {
        token = uuidv4();
        await updateDoc(doc(db, 'users', user.uid, 'familyTrees', tree.id), { shareToken: token, privacy: 'link' });
      }
      const link = `${window.location.origin}/view/${tree.id}?token=${token}`;
      navigator.clipboard.writeText(link);
      toast({ title: 'קישור שיתוף הועתק', description: 'כל מי עם הקישור יכול לצפות בעץ.' });
      fetchTrees();
    } catch(e) {
      toast({ variant: 'destructive', title: 'שגיאה ביצירת קישור' });
    }
  };
  
  const handleSetPublic = async (tree: FamilyTree) => {
    if (!user || !db) return;
    try {
      const batch = writeBatch(db);
      const treeRef = doc(db, 'users', user.uid, 'familyTrees', tree.id);
      batch.update(treeRef, { privacy: 'public' });
      
      const publicTreeRef = doc(db, "publicTrees", tree.id);
      batch.set(publicTreeRef, {
        ownerUserId: user.uid,
        ownerName: user.displayName || 'Unknown',
        treeName: tree.treeName,
        personCount: tree.personCount || 0,
        relationshipCount: tree.relationshipCount || 0,
        createdAt: tree.createdAt,
      });

      await batch.commit();
      toast({ title: 'העץ כעת ציבורי' });
      fetchTrees();
    } catch (e) {
      toast({ variant: 'destructive', title: 'שגיאה בעדכון הגדרות' });
    }
  };


  const handleDeleteClick = (tree: FamilyTree) => {
    setTreeToDelete(tree);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!treeToDelete || !user || !db) return;
    setIsDeleting(true);

    try {
      const batch = writeBatch(db);
      const treeDocRef = doc(db, 'users', user.uid, 'familyTrees', treeToDelete.id);

      const collectionsToDelete = ['people', 'relationships', 'canvasPositions', 'manualEvents', 'exportedFiles'];
      for (const coll of collectionsToDelete) {
        const subCollectionRef = collection(treeDocRef, coll);
        const snapshot = await getDocs(subCollectionRef);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
      }

      batch.delete(treeDocRef);
      if(treeToDelete.privacy === 'public') {
        batch.delete(doc(db, 'publicTrees', treeToDelete.id));
      }

      await batch.commit();
      
      toast({
        title: 'עץ נמחק',
        description: `"${treeToDelete.treeName}" וכל הנתונים שלו נמחקו.`,
      });
      fetchTrees();

    } catch (error: any) {
        const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/familyTrees/${treeToDelete.id}`, operation: 'delete' });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'שגיאה',
          description: "Failed to delete tree and associated data.",
        });
    }

    setIsDeleting(false);
    setIsAlertOpen(false);
    setTreeToDelete(null);
  };
  
  const handleNewTreeClick = () => {
    if (isAnonymous) {
      router.push('/login');
    } else {
      setIsDialogOpen(true);
    }
  }

  const renderContent = () => {
    if (isLoading || isUserLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
          {[...Array(4)].map((_, i) => (
            <TreeCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (isAnonymous) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center mt-8">
          <h3 className="mt-4 text-lg font-semibold">ברוכים הבאים!</h3>
          <p className="mt-1 text-sm text-muted-foreground">היכנסו או הירשמו כדי ליצור ולנהל את עצי המשפחה שלכם.</p>
          <Button className="mt-6" onClick={() => router.push('/login')}>
            <LogIn className="ml-2 h-4 w-4" />
            כניסה או הרשמה
          </Button>
        </div>
      );
    }

    if (myTrees.length === 0 && sharedTrees.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center mt-8">
          <h3 className="mt-4 text-lg font-semibold">לא נמצאו עצים</h3>
          <p className="mt-1 text-sm text-muted-foreground">התחילו ביצירת עץ המשפחה הראשון שלכם.</p>
          <Button className="mt-6" onClick={handleNewTreeClick}>
            <PlusCircle className="ml-2 h-4 w-4" />
            צור עץ חדש
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-12 mt-8">
        {myTrees.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-4"><Users className="text-primary"/>העצים שלי</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myTrees.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  type="owned"
                  onDelete={() => handleDeleteClick(tree)}
                  onDuplicate={() => handleDuplicateTree(tree)}
                  onShare={() => handleOpenShareDialog(tree)}
                  onSetPublic={() => handleSetPublic(tree)}
                  onCreateShareLink={() => handleCreateShareLink(tree)}
                />
              ))}
            </div>
          </section>
        )}
        {sharedTrees.length > 0 && (
           <section>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-4"><Share2 className="text-primary"/>עצים ששותפו איתי</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sharedTrees.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  type="shared"
                />
              ))}
            </div>
          </section>
        )}
         {publicTrees.length > 0 && (
           <section>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-4"><Globe className="text-primary"/>עצים ציבוריים</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {publicTrees.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  type="public"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl text-foreground">
                ברוכים השבים, {user?.displayName || 'אורח'}
            </h1>
            <p className="mt-6 text-lg max-w-2xl mx-auto text-muted-foreground">
                נהל את עצי המשפחה שלך, שתף עם קרובים, וגלה את הסיפורים המסתתרים בין הענפים.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button size="lg" onClick={handleNewTreeClick}>
                    <PlusCircle className="ml-2 h-5 w-5" />
                    צור עץ חדש
                </Button>
                <Button size="lg" variant="ghost" onClick={() => router.push('/')}>
                    בנה עם AI <span aria-hidden="true">→</span>
                </Button>
            </div>
        </div>
        <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl xl:-top-6" aria-hidden="true">
            <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#80ff89] to-[#26a69a] opacity-20" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
        </div>
      </div>

      <main className="container mx-auto py-8 px-4">
        {renderContent()}
      </main>

      <NewTreeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTreeCreated={onTreeCreated}
      />
      
      <ShareTreeDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        onShare={handleShareSubmit}
        treeName={treeToShare?.treeName || ''}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח לחלוטין?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את העץ{' '}
              <strong className="text-foreground">
                {treeToDelete?.treeName}
              </strong>{' '}
              וכל האנשים, הקשרים והנתונים המשויכים אליו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              מחק
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
