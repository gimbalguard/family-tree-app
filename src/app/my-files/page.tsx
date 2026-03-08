import { AppHeader } from "@/components/app-header";
import { MyFilesClient } from "./my-files-client";

export default function MyFilesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader />
      <main className="flex-1">
        <MyFilesClient />
      </main>
    </div>
  );
}
