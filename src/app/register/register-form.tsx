'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, writeBatch, query, collection, where, getDocs } from 'firebase/firestore';

const formSchema = z.object({
  username: z.string().min(3, { message: 'שם משתמש חייב להכיל לפחות 3 תווים.' }),
  email: z.string().email({ message: 'אנא הזן כתובת אימייל חוקית.' }),
  password: z.string().min(8, { message: 'סיסמה חייבת להכיל לפחות 8 תווים.' }),
});

export function RegisterForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );
        const user = userCredential.user;

        await updateProfile(user, { displayName: values.username });
        
        const batch = writeBatch(db);

        const userProfileRef = doc(db, 'users', user.uid);
        const userProfile = {
          id: user.uid,
          username: values.username,
          createdAt: serverTimestamp(),
        };
        batch.set(userProfileRef, userProfile);

        const userEmailRef = doc(db, 'userEmails', values.email);
        const userEmail = {
            uid: user.uid,
            email: values.email,
            createdAt: serverTimestamp(),
        }
        batch.set(userEmailRef, userEmail);

        await batch.commit();

        // After creating user, check for pending shares
        const pendingSharesQuery = query(
            collection(db, "sharedTrees"),
            where("sharedWithEmail", "==", values.email)
        );
        const pendingSharesSnap = await getDocs(pendingSharesQuery);

        if (!pendingSharesSnap.empty) {
            const updateBatch = writeBatch(db);
            pendingSharesSnap.forEach(shareDoc => {
                updateBatch.update(shareDoc.ref, { sharedWithUserId: user.uid });
            });
            await updateBatch.commit();
            toast({ title: "עצים ששותפו איתך נוספו לחשבונך!" });
        }
        
        // On success, redirect is handled by the auth state listener
      } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאת הרשמה',
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>שם משתמש</FormLabel>
              <FormControl>
                <Input placeholder="your_username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>אימייל</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>סיסמה</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          צור חשבון
        </Button>
      </form>
    </Form>
  );
}
