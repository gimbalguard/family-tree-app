import { AuthGuard } from "@/components/auth-guard";
import { TreeClient } from "./tree-client";

type TreePageProps = {
  params: {
    treeId: string;
  };
};

export default function TreePage({ params }: TreePageProps) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full flex-col bg-background">
        <TreeClient treeId={params.treeId} />
      </div>
    </AuthGuard>
  );
}
