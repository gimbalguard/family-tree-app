'use client';
import { TreePageClient } from '@/app/tree/[treeId]/tree-page-client';
import { ReactFlowProvider } from 'reactflow';

export function ViewPageClient({ treeId }: { treeId: string }) {
  // This component now simply wraps the main TreePageClient in a ReactFlowProvider
  // and passes the readOnly prop to enable the view-only mode.
  return (
    <ReactFlowProvider>
      <TreePageClient treeId={treeId} readOnly={true} />
    </ReactFlowProvider>
  );
}
