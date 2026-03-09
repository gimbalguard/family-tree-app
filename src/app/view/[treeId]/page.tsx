import { ViewPageClient } from './view-client';

type ViewPageProps = {
  params: {
    treeId: string;
  };
};

export default function ViewPage({ params }: ViewPageProps) {
  return <ViewPageClient treeId={params.treeId} />;
}
