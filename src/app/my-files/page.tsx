import { AppHeader } from "@/components/app-header";
import { MyFilesClient } from "./my-files-client";

export default function MyFilesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader />
      <MyFilesClient />
    </div>
  );
}
