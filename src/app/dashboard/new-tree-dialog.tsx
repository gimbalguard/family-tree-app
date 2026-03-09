
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { FamilyTree } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const formSchema = z.object({
  treeName: z.string().min(3, 'שם העץ חייב להכיל לפחות 3 תווים.'),
});

type NewTreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTreeCreated: (newTree: FamilyTree) => void;
};

export function NewTreeDialog({
  open,
  onOpenChange,
  onTreeCreated,
}: NewTreeDialogProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      treeName: '',
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(isOpen);
      if (!isOpen) {
        form.reset();
      }
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || user.isAnonymous || !db) {
      toast({
        variant: 'destructive',
        title: 'נדרש אימות',
        description: 'אנא היכנס כדי ליצור עץ חדש.',
      });
      router.push('/login');
      return;
    }

    setIsLoading(true);

    const treeData = {
      treeName: values.treeName,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'familyTrees'), treeData);
      const newTree: FamilyTree = {
        id: docRef.id,
        treeName: values.treeName,
        userId: user.uid,
        createdAt: new Date() as any, 
        updatedAt: new Date() as any,
      };
      
      toast({
        title: 'עץ נוצר',
        description: `העץ החדש שלך "${newTree.treeName}" מוכן.`,
      });
      onTreeCreated(newTree);
      handleOpenChange(false);

    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees`,
        operation: 'create',
        requestResourceData: { treeName: values.treeName, userId: user.uid }
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה ביצירת עץ',
        description: permissionError.message,
      });
    }

    setIsLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => { e.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}>
        <DialogHeader>
          <DialogTitle>צור עץ משפחה חדש</DialogTitle>
          <DialogDescription>
            תן שם לעץ המשפחה החדש שלך. תוכל לשנות אותו מאוחר יותר.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="treeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם העץ</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="לדוגמה: משפחת כהן"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
                ביטול
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                צור עץ
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
