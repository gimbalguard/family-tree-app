import { PublicPageGuard } from "@/components/public-page-guard";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/icons";
import Link from "next/link";

export default function LoginPage() {
  return (
    <PublicPageGuard>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl">
            <CardHeader className="items-center text-center">
              <Link href="/">
                <Logo className="mb-4 h-12 w-12 text-primary" />
              </Link>
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <p className="text-muted-foreground">
                Sign in to manage your family trees.
              </p>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
           <p className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Sign up
              </Link>
            </p>
        </div>
      </div>
    </PublicPageGuard>
  );
}
