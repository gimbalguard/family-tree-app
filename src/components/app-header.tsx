'use client';
import Link from 'next/link';
import { Logo } from './icons';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';


export function AppHeader() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?';
  const isAnonymous = user?.isAnonymous ?? true;

  const handleLogout = async () => {
    await signOut(auth);
    // signInAnonymously is called automatically by the provider
    router.push('/dashboard');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-6 text-primary" />
            <span className="font-bold">FamilyTree</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end">
          {isUserLoading ? (
            <div className='h-8 w-20 animate-pulse rounded-md bg-muted'/>
          ) : isAnonymous ? (
            <div className='flex items-center gap-2'>
                <Button variant="ghost" onClick={() => router.push('/login')}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                </Button>
                <Button onClick={() => router.push('/register')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign Up
                </Button>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL ?? ''} alt={user?.displayName ?? ''} />
                    <AvatarFallback>{userInitial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.displayName ?? 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
