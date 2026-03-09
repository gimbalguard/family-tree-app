import { ViewPageClient } from './view-client';

type ViewPageProps = {
  params: {
    treeId: string;
  };
};

export default function ViewPage({ params }: ViewPageProps) {
  // The server component simply passes the treeId to the client component.
  return <ViewPageClient treeId={params.treeId} />;
}
