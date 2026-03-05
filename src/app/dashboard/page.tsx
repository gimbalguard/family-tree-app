import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full flex-col">
        <AppHeader />
        <main className="flex-1">
          <DashboardClient />
        </main>
      </div>
    </AuthGuard>
  );
}
