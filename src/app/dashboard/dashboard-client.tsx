'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/firebase';
import type { FamilyTree } from '@/lib/types';
import { getTreesForUser, deleteTree } from '@/lib/actions/trees';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Users } from 'lucide-react';
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

export function DashboardClient() {
  const { user } = useUser();
  const { toast } = useToast();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<FamilyTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTrees = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      const userTrees = await getTreesForUser(user.uid);
      setTrees(userTrees);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrees();
  }, [fetchTrees]);

  const onTreeCreated = () => {
    fetchTrees();
  };

  const handleDeleteClick = (tree: FamilyTree) => {
    setTreeToDelete(tree);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!treeToDelete || !user) return;
    setIsDeleting(true);
    const result = await deleteTree(treeToDelete.id);

    if (result.success) {
      toast({
        title: 'Tree Deleted',
        description: `"${treeToDelete.treeName}" and all its data have been removed.`,
      });
      setTrees(trees.filter((tree) => tree.id !== treeToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    }
    setIsDeleting(false);
    setIsAlertOpen(false);
    setTreeToDelete(null);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Family Trees</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Tree
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(3)].map((_, i) => (
            <TreeCardSkeleton key={i} />
          ))}
        </div>
      ) : trees.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              onDelete={() => handleDeleteClick(tree)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No trees found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first family tree.
          </p>
          <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Tree
          </Button>
        </div>
      )}

      <NewTreeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTreeCreated={onTreeCreated}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tree{' '}
              <strong className="text-foreground">
                {treeToDelete?.treeName}
              </strong>{' '}
              and all associated people, relationships, and data. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
