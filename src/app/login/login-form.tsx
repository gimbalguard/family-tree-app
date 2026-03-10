
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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'אנא הזן כתובת אימייל חוקית.' }),
  password: z.string().min(1, { message: 'נדרשת סיסמה.' }),
});

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      const user = userCredential.user;
      if (db) {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
              // User exists in Auth but not Firestore. Create the doc to fix the missing profile.
              await setDoc(userDocRef, {
                  id: user.uid,
                  username: user.displayName || values.email.split('@')[0],
                  createdAt: serverTimestamp(),
              });
              toast({
                  title: "פרופיל משתמש שוחזר",
                  description: "הפרופיל החסר שלך נוצר מחדש במסד הנתונים.",
              });
          }
      }
      // On success, the onAuthStateChanged listener in FirebaseProvider will
      // update the user state, and the AuthGuard/PublicPageGuard will redirect.
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאת אימות',
        description: 'שם משתמש או סיסמה שגויים.',
      });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          התחבר
        </Button>
      </form>
    </Form>
  );
}
