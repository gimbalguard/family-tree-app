'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import type { FamilyTree } from '@/lib/types';
import { getTreesForUser, deleteTree } from '@/lib/actions/trees';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Users, LogIn } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function DashboardClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<FamilyTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAnonymous = user?.isAnonymous ?? true;

  const fetchTrees = useCallback(async () => {
    if (user && !user.isAnonymous) {
      setIsLoading(true);
      const userTrees = await getTreesForUser(db, user.uid);
      setTrees(userTrees);
      setIsLoading(false);
    } else {
      setTrees([]);
      setIsLoading(false);
    }
  }, [user, db]);

  useEffect(() => {
    if (!isUserLoading) {
      fetchTrees();
    }
  }, [isUserLoading, fetchTrees]);

  const onTreeCreated = (newTree: FamilyTree) => {
    // After creating a tree, redirect to its page
    router.push(`/tree/${newTree.id}`);
  };

  const handleDeleteClick = (tree: FamilyTree) => {
    setTreeToDelete(tree);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!treeToDelete || !user || user.isAnonymous) return;
    setIsDeleting(true);
    const result = await deleteTree(db, { userId: user.uid, treeId: treeToDelete.id });

    if (result.success) {
      toast({
        title: 'עץ נמחק',
        description: `"${treeToDelete.treeName}" וכל הנתונים שלו נמחקו.`,
      });
      setTrees(trees.filter((tree) => tree.id !== treeToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: result.error,
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(3)].map((_, i) => (
            <TreeCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (isAnonymous) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">ברוכים הבאים ל-FamilyTree</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            היכנסו כדי ליצור ולנהל את עצי המשפחה שלכם.
          </p>
          <Button className="mt-6" onClick={() => router.push('/login')}>
            <LogIn className="ml-2 h-4 w-4" />
            כניסה או הרשמה
          </Button>
        </div>
      );
    }

    if (trees.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              onDelete={() => handleDeleteClick(tree)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">לא נמצאו עצים</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          התחילו ביצירת עץ המשפחה הראשון שלכם.
        </p>
        <Button className="mt-6" onClick={handleNewTreeClick}>
          <PlusCircle className="ml-2 h-4 w-4" />
          צור עץ חדש
        </Button>
      </div>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">עצי המשפחה שלך</h1>
        <Button onClick={handleNewTreeClick}>
          {isAnonymous ? (
            <LogIn className="ml-2 h-4 w-4" />
          ) : (
            <PlusCircle className="ml-2 h-4 w-4" />
          )}
          עץ חדש
        </Button>
      </div>

      {renderContent()}

      <NewTreeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTreeCreated={onTreeCreated}
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
    </div>
  );
}
