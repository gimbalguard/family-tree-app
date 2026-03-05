'use client';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';

export default function HomePage() {
  const { user, isUserLoading: loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <Logo className="h-12 w-12 text-primary" />
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
