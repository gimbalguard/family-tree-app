'use client';
import { useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { TreeClient } from "./tree-client";
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';

// Props received from the Server Component page
type TreePageClientProps = {
  treeId: string;
};

// This component contains the original client-side logic
export function TreePageClient({ treeId }: TreePageClientProps) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!user || user.isAnonymous)) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user || user.isAnonymous) {
     return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <TreeClient treeId={treeId} />
    </div>
  );
}
