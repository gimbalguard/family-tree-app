import { TreePageClient } from './tree-page-client';

type TreePageProps = {
  params: Promise<{
    treeId: string;
  }>;
};

export default async function TreePage({ params }: TreePageProps) {
  const resolvedParams = await params;
  return <TreePageClient treeId={resolvedParams.treeId} readOnly={false} />;
}
