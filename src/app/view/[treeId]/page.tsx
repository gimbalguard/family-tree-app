import { ViewPageClient } from './view-client';

type ViewPageProps = {
  params: Promise<{
    treeId: string;
  }>;
};

export default async function ViewPage({ params }: ViewPageProps) {
  const resolvedParams = await params;
  // The server component simply passes the treeId to the client component.
  return <ViewPageClient treeId={resolvedParams.treeId} />;
}
