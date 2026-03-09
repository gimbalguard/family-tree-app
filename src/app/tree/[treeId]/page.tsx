import { TreePageClient } from './tree-page-client';

type TreePageProps = {
  params: {
    treeId: string;
  };
};

export default function TreePage({ params }: TreePageProps) {
  return <TreePageClient treeId={params.treeId} readOnly={false} />;
}
