
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useUser, useFirestore, useStorage } from '@/firebase';
import type { FamilyTree, SharedTree } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, LogIn, Share2, Globe, Copy, Link as LinkIcon, Edit, Upload, Lock, Users, AlertTriangle } from 'lucide-react';
import { NewTreeDialog } from './new-tree-dialog';
import { TreeCard, TreeCardSkeleton } from './tree-card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ShareTreeDialog } from './share-tree-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, writeBatch, doc, addDoc, getDoc, updateDoc, where, collectionGroup, limit, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Relationship, CanvasPosition } from '@/lib/types';


export function DashboardClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [myTrees, setMyTrees] = useState<(FamilyTree & { isRecovered?: boolean })[]>([]);
  const [incomingSharedTrees, setIncomingSharedTrees] = useState<SharedTree[]>([]);
  const [outgoingShares, setOutgoingShares] = useState<Map<string, string[]>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [treeToShare, setTreeToShare] = useState<FamilyTree | null>(null);

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<FamilyTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [treeToUploadCover, setTreeToUploadCover] = useState<FamilyTree | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const isAnonymous = user?.isAnonymous ?? true;

  const fetchData = useCallback(async () => {
    if (isUserLoading || !db || !user) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }
    if (user.isAnonymous) {
        setIsLoading(false);
        return;
    }


    setIsLoading(true);
    try {
      // 1. Fetch My Trees
      const myTreesRef = collection(db, 'users', user.uid, 'familyTrees');
      const myTreesSnapshot = await getDocs(myTreesRef);
      const myTreesPromises = myTreesSnapshot.docs.map(async (treeDoc) => {
        const treeData = { id: treeDoc.id, ...treeDoc.data() } as FamilyTree;
        
        // Fetch real counts
        const peopleRef = collection(db, 'users', user.uid, 'familyTrees', treeDoc.id, 'people');
        const relsRef = collection(db, 'users', user.uid, 'familyTrees', treeDoc.id, 'relationships');
        const [peopleSnap, relsSnap] = await Promise.all([
          getDocs(query(peopleRef, limit(1000))), // Firestore count is in beta, so we fetch docs
          getDocs(query(relsRef, limit(1000))),
        ]);
        treeData.personCount = peopleSnap.size; 
        treeData.relationshipCount = relsSnap.size;

        return treeData;
      });
      let userTrees = (await Promise.all(myTreesPromises));

      // --- RECOVERY LOGIC ---
      if (user.email === 'yakiravidar@gmail.com') {
          const oldUserId = 'fsW3k9bT24XDIPHiuoL56U5zuKF3';
          if (user.uid !== oldUserId) {
            const recoveredTreesRef = collection(db, 'users', oldUserId, 'familyTrees');
            const recoveredTreesSnapshot = await getDocs(recoveredTreesRef);
            const recoveredTrees = recoveredTreesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                isRecovered: true,
            } as FamilyTree & { isRecovered: boolean }));
            userTrees = [...userTrees, ...recoveredTrees];
          }
      }
      setMyTrees(userTrees);


      // 2. Fetch all shares related to the user
      const sharesOwnedQuery = query(collection(db, "sharedTrees"), where("ownerUserId", "==", user.uid));
      const sharesReceivedQuery = query(collection(db, "sharedTrees"), where("sharedWithUserId", "==", user.uid));
      
      const [sharesOwnedSnapshot, sharesReceivedSnapshot] = await Promise.all([
          getDocs(sharesOwnedQuery),
          getDocs(sharesReceivedQuery)
      ]);

      // 3. Process outgoing shares (trees I own and shared with others)
      const outgoingMap = new Map<string, string[]>();
      sharesOwnedSnapshot.forEach(doc => {
          const share = doc.data() as SharedTree;
          const emails = outgoingMap.get(share.treeId) || [];
          emails.push(share.sharedWithEmail);
          outgoingMap.set(share.treeId, emails);
      });
      setOutgoingShares(outgoingMap);

      // 4. Process incoming shares (trees others shared with me)
      setIncomingSharedTrees(sharesReceivedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedTree)));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
    }
    setIsLoading(false);
  }, [user, db, toast, isUserLoading]);

  useEffect(() => {
    if (!isUserLoading && user) {
      fetchData();
    } else if (!isUserLoading && !user) {
      setIsLoading(false);
    }
  }, [isUserLoading, user, fetchData]);

  const onTreeCreated = (newTree: FamilyTree) => {
    router.push(`/tree/${newTree.id}`);
  };

  const handleDuplicateTree = async (treeToDuplicate: FamilyTree) => {
    if (!user || !db) return;
    
    // For recovered trees, the owner ID is the OLD one.
    const ownerId = (treeToDuplicate as any).isRecovered ? 'fsW3k9bT24XDIPHiuoL56U5zuKF3' : user.uid;

    toast({ title: 'משכפל עץ, אנא המתן...' });
    try {
        const newTreeRef = doc(collection(db, 'users', user.uid, 'familyTrees'));
        const newTreeId = newTreeRef.id;
        const batch = writeBatch(db);
        const newTreeData = {
            userId: user.uid,
            treeName: `${treeToDuplicate.treeName} - עותק`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            language: treeToDuplicate.language || 'he',
            privacy: 'private' as const,
            ownerPersonId: treeToDuplicate.ownerPersonId || '',
        };
        batch.set(newTreeRef, newTreeData);

        const basePath = `users/${ownerId}/familyTrees/${treeToDuplicate.id}`;
        const peopleRef = collection(db, basePath, 'people');
        const relsRef = collection(db, basePath, 'relationships');
        const posRef = collection(db, basePath, 'canvasPositions');
        
        const [peopleSnap, relsSnap, posSnap] = await Promise.all([ getDocs(peopleRef), getDocs(relsRef), getDocs(posRef) ]);
        
        const oldPersonIdToNewPersonIdMap = new Map<string, string>();

        peopleSnap.forEach(d => {
            const oldPersonData = d.data();
            const { id, createdAt, updatedAt, ...restOfPerson } = oldPersonData as Person;
            const newPersonDocRef = doc(collection(newTreeRef, 'people'));
            oldPersonIdToNewPersonIdMap.set(d.id, newPersonDocRef.id);
            batch.set(newPersonDocRef, {
                ...restOfPerson,
                userId: user.uid,
                treeId: newTreeId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

        relsSnap.forEach(d => {
            const oldRelData = d.data();
            const { id, createdAt, updatedAt, personAId, personBId, ...restOfRel } = oldRelData as Relationship;
            const newPersonAId = oldPersonIdToNewPersonIdMap.get(personAId);
            const newPersonBId = oldPersonIdToNewPersonIdMap.get(personBId);
            if (newPersonAId && newPersonBId) {
                const newRelDocRef = doc(collection(newTreeRef, 'relationships'));
                batch.set(newRelDocRef, {
                    ...restOfRel,
                    userId: user.uid,
                    treeId: newTreeId,
                    personAId: newPersonAId,
                    personBId: newPersonBId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
        });

        posSnap.forEach(d => {
            const oldPosData = d.data();
            const { id, updatedAt, personId, ...restOfPos } = oldPosData as CanvasPosition;
            const newPersonId = oldPersonIdToNewPersonIdMap.get(personId);
            if (newPersonId) {
                const newPosDocRef = doc(collection(newTreeRef, 'canvasPositions'), newPersonId);
                batch.set(newPosDocRef, {
                    ...restOfPos,
                    userId: user.uid,
                    treeId: newTreeId,
                    personId: newPersonId,
                    updatedAt: serverTimestamp(),
                });
            }
        });
        
        await batch.commit();
        toast({ title: 'העץ שוכפל בהצלחה!' });
        fetchData();
    } catch (error) {
        console.error("Error duplicating tree:", error);
        toast({ variant: 'destructive', title: 'שגיאה בשכפול העץ', description: 'לא ניתן היה להשלים את הפעולה.' });
    }
  };

  const handleOpenShareDialog = (tree: FamilyTree) => {
    setTreeToShare(tree);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsShareDialogOpen(true));
  };
  
  const handleShareSubmit = async (email: string) => {
    if (!treeToShare || !user || !db) return;
    try {
      const emailQuery = query(collection(db, "userEmails"), where("email", "==", email), limit(1));
      const emailSnap = await getDocs(emailQuery);

      let targetUserId: string | null = null;
      if (!emailSnap.empty) {
        targetUserId = emailSnap.docs[0].data().uid;
      }
      
      const sharedDocData = {
        ownerUserId: user.uid,
        ownerName: user.displayName || 'Unknown',
        treeId: treeToShare.id,
        treeName: treeToShare.treeName,
        sharedWithEmail: email,
        sharedWithUserId: targetUserId,
        canEdit: true,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "sharedTrees"), sharedDocData);

      toast({ title: 'העץ שותף בהצלחה', description: `הזמנה לשיתוף העץ "${treeToShare.treeName}" נשלחה ל-${email}.` });
      setIsShareDialogOpen(false);
      setTreeToShare(null);
      fetchData(); // Refetch to show new shared status
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
      fetchData();
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
        id: tree.id,
        ownerUserId: user.uid,
        ownerName: user.displayName || 'Unknown',
        treeName: tree.treeName,
        personCount: tree.personCount || 0,
        relationshipCount: tree.relationshipCount || 0,
        createdAt: tree.createdAt,
        coverPhotoURL: tree.coverPhotoURL || '',
      });
      await batch.commit();
      toast({ title: 'העץ כעת ציבורי' });
      fetchData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'שגיאה בעדכון הגדרות' });
    }
  };

  const handleSetPrivate = async (tree: FamilyTree) => {
    if (!user || !db) return;
    try {
      const batch = writeBatch(db);
      const treeRef = doc(db, 'users', user.uid, 'familyTrees', tree.id);
      batch.update(treeRef, { privacy: 'private' });
      
      const publicTreeRef = doc(db, "publicTrees", tree.id);
      batch.delete(publicTreeRef);

      await batch.commit();
      toast({ title: 'העץ כעת פרטי' });
      fetchData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'שגיאה בעדכון הגדרות' });
    }
  };

  const handleUploadCoverClick = (tree: FamilyTree) => {
    setTreeToUploadCover(tree);
    coverFileInputRef.current?.click();
  };

  const handleCoverFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !treeToUploadCover || !user || !storage || !db) return;

    setIsUploadingCover(true);
    toast({ title: 'מעלה תמונת נושא...' });

    try {
      const storagePath = `users/${user.uid}/trees/${treeToUploadCover.id}/cover-${file.name}`;
      const fileRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeToUploadCover.id);
      await updateDoc(treeRef, { coverPhotoURL: downloadURL });
      
      if (treeToUploadCover.privacy === 'public') {
          const publicTreeRef = doc(db, 'publicTrees', treeToUploadCover.id);
          await updateDoc(publicTreeRef, { coverPhotoURL: downloadURL });
      }

      toast({ title: 'תמונת הנושא עודכנה!' });
      fetchData();
    } catch (error) {
      console.error("Cover photo upload error:", error);
      toast({ variant: 'destructive', title: 'שגיאה בהעלאת התמונה' });
    } finally {
      setIsUploadingCover(false);
      setTreeToUploadCover(null);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClick = (tree: FamilyTree) => {
    setTreeToDelete(tree);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsAlertOpen(true));
  };

  const handleConfirmDelete = async () => {
    if (!treeToDelete || !user || !db) return;
    setIsDeleting(true);
    
    // For recovered trees, the owner ID is the OLD one.
    const ownerId = (treeToDelete as any).isRecovered ? 'fsW3k9bT24XDIPHiuoL56U5zuKF3' : user.uid;

    try {
        const batch = writeBatch(db);
        const treeDocRef = doc(db, 'users', ownerId, 'familyTrees', treeToDelete.id);
        batch.delete(treeDocRef);
        
        const sharedTreesQuery = query(collection(db, "sharedTrees"), where("treeId", "==", treeToDelete.id), where("ownerUserId", "==", ownerId));
        const sharedTreesSnapshot = await getDocs(sharedTreesQuery);
        sharedTreesSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        if (treeToDelete.privacy === 'public') {
            const publicTreeRef = doc(db, "publicTrees", treeToDelete.id);
            batch.delete(publicTreeRef);
        }

        await batch.commit();

        toast({
            title: 'עץ נמחק',
            description: `"${treeToDelete.treeName}" הוסר מהרשימה שלך.`,
        });

        fetchData();
    } catch (error: any) {
        console.error("Error deleting tree:", error);
        toast({
            variant: 'destructive',
            title: 'שגיאה במחיקת העץ',
            description: "לא ניתן היה למחוק את העץ. נסה שוב.",
        });
    } finally {
        setIsDeleting(false);
        setIsAlertOpen(false);
        setTreeToDelete(null);
    }
};
  
  const handleNewTreeClick = () => {
    if (isAnonymous) {
      router.push('/login');
    } else {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsDialogOpen(true));
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
          <h3 className="mt-4 text-lg font-semibold">ברוכים השבים!</h3>
          <p className="mt-1 text-sm text-muted-foreground">היכנסו או הירשמו כדי ליצור ולנהל את עצי המשפחה שלכם.</p>
          <Button className="mt-6" onClick={() => router.push('/login')}>
            <LogIn className="ml-2 h-4 w-4" />
            כניסה או הרשמה
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-12 mt-8">
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">העצים שיצרתי</h2>
          {myTrees.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myTrees.map((tree) => (
                <TreeCard
                  key={`my-tree-${tree.id}`}
                  tree={tree}
                  type="owned"
                  sharedWith={outgoingShares.get(tree.id)}
                  isRecovered={(tree as any).isRecovered}
                  onDelete={() => handleDeleteClick(tree)}
                  onDuplicate={() => handleDuplicateTree(tree)}
                  onShare={() => handleOpenShareDialog(tree)}
                  onSetPublic={() => handleSetPublic(tree)}
                  onSetPrivate={() => handleSetPrivate(tree)}
                  onUploadCover={() => handleUploadCoverClick(tree)}
                  onCreateShareLink={() => handleCreateShareLink(tree)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-16 text-center">
              <h3 className="mt-4 text-lg font-semibold">עדיין לא יצרת עצים.</h3>
              <p className="mt-1 text-sm text-muted-foreground">לחץ על 'צור עץ חדש' כדי להתחיל.</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            עצים ששותפו איתי
          </h2>
          {incomingSharedTrees.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {incomingSharedTrees.map((tree) => (
                <TreeCard
                  key={`shared-${tree.id}`}
                  tree={tree}
                  type="shared"
                />
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-16 text-center">
              <h3 className="mt-4 text-lg font-semibold">עצים לא שותפו איתך עדיין.</h3>
              <p className="mt-1 text-sm text-muted-foreground">כאשר משתמש אחר ישתף איתך עץ, הוא יופיע כאן.</p>
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <>
      <input
        type="file"
        ref={coverFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleCoverFileSelected}
        disabled={isUploadingCover}
      />
      <div className="relative isolate overflow-hidden bg-slate-900">
        <div className="container mx-auto px-4 py-16 sm:py-24 lg:py-32 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                ברוכים השבים, {user?.displayName || 'אורח'}
            </h1>
            <p className="mt-6 text-lg max-w-2xl mx-auto text-slate-300">
                נהל את עצי המשפחה שלך, שתף עם קרובים, וגלה את הסיפורים המסתתרים בין הענפים.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button size="lg" onClick={handleNewTreeClick}>
                    <PlusCircle className="ml-2 h-5 w-5" />
                    צור עץ חדש
                </Button>
                <Button size="lg" variant="secondary" onClick={() => router.push('/')}>
                    בנה עם AI <span aria-hidden="true">→</span>
                </Button>
            </div>
        </div>
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#16a34a] to-[#26a69a] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" style={{clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'}}></div>
        </div>
      </div>

      <main className="container mx-auto py-8 px-4">
        {user?.email === 'yakiravidar@gmail.com' && myTrees.some(t => (t as any).isRecovered) && (
            <div className='p-4 mb-8 border-l-4 border-yellow-400 bg-yellow-50 rounded-md text-yellow-800'>
                <div className='flex'>
                    <div className='flex-shrink-0'>
                        <AlertTriangle className='h-5 w-5 text-yellow-500'/>
                    </div>
                    <div className='ml-3 mr-3'>
                        <h3 className='text-sm font-medium'>עצים לשחזור</h3>
                        <div className='mt-2 text-sm'>
                            <p>זיהינו עצים ששייכים לחשבונך הישן. כדי לקבל בעלות מלאה עליהם, השתמש בכפתור השכפול (העתקה) עבור כל עץ מסומן. לאחר שתשכפל את כולם, תוכל למחוק בבטחה את העצים המשוחזרים.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
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
        <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => { e.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}>
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
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
