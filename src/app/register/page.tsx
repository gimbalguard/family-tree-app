import { PublicPageGuard } from "@/components/public-page-guard";
import { RegisterForm } from "./register-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Logo } from "@/components/icons";

export default function RegisterPage() {
  return (
    <PublicPageGuard>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl">
            <CardHeader className="items-center text-center">
              <Link href="/">
                <Logo className="mb-4 h-12 w-12 text-primary" />
              </Link>
              <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
              <p className="text-muted-foreground">
                Start building your family history today.
              </p>
            </CardHeader>
            <CardContent>
              <RegisterForm />
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicPageGuard>
  );
}
