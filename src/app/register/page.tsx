'use client';

import { useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { RegisterForm } from "./register-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Logo } from "@/components/icons";
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If a non-anonymous user is found, redirect to dashboard
    if (!isUserLoading && user && !user.isAnonymous) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  // Show a loading state while checking for user or if we are about to redirect
  if (isUserLoading || (user && !user.isAnonymous)) {
     return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl">
            <CardHeader className="items-center text-center">
              <Link href="/">
                <Logo className="mb-4 h-12 w-12 text-primary" />
              </Link>
              <CardTitle className="text-2xl font-bold">צור חשבון</CardTitle>
              <p className="text-muted-foreground">
                התחל לבנות את היסטוריית המשפחה שלך עוד היום.
              </p>
            </CardHeader>
            <CardContent>
              <RegisterForm />
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            יש לך כבר חשבון?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              התחבר
            </Link>
          </p>
        </div>
      </div>
  );
}
