import { TreePageClient } from './tree-page-client';

type TreePageProps = {
  params: {
    treeId: string;
  };
};

// This is now a Server Component
export default function TreePage({ params }: TreePageProps) {
  // It extracts the treeId from params and passes it as a simple prop
  // to the client component. This is the recommended pattern.
  return <TreePageClient treeId={params.treeId} />;
}
