
'use client';

import type React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';
import { Button } from '@/components/ui/button';
import { Bell, Landmark, UserCircle, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react'; // Added useEffect import

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading: authIsLoading, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = () => {
    logout(); // AuthContext's useEffect will handle redirection to /login
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
  };

  if (authIsLoading) {
    // AuthContext is actively processing login/logout.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // If AppLayout is rendered, and AuthProvider is NOT processing auth:
  // - If 'user' is null AND we are NOT on the login page, it means AuthProvider
  //   should be redirecting or showing its "Redirecting..." loader.
  //   This "Verifying session..." screen in AppLayout is a fallback for any transient state.
  if (!user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  // If user is null AND pathname IS '/login', AppLayout renders its structure,
  // and LoginPage (as children) is displayed.
  // If user is authenticated, AppLayout renders its structure,
  // and the protected page (as children) is displayed.

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarRail />
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Landmark className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold text-primary group-data-[state=expanded]:opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:hidden transition-opacity duration-200">LoanFlow</h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-4">
          {/* Footer content can be added here if needed later */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex items-center gap-4 ml-auto">
            {user ? (
              <>
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Notifications</span>
                </Button>
                <div className="flex items-center gap-2">
                  <UserCircle className="h-6 w-6 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium">{user.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{user.role}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="mr-1 h-4 w-4" /> Sign Out
                  </Button>
                </div>
              </>
            ) : (
              // Show Sign In button if no user and currently on login page
              pathname === '/login' && (
                <Button variant="outline" onClick={() => router.push('/login')}>
                  Sign In
                </Button>
              )
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
