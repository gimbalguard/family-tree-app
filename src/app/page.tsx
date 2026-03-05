import { AppHeader } from "@/components/app-header";
import { AiBuildClient } from "./ai-build-client";

export default function AiBuildPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader />
      <main className="flex-1">
        <AiBuildClient />
      </main>
    </div>
  );
}
