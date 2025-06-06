
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
    // AuthContext is actively processing login/logout or initial load.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // If auth is NOT actively processing, but there's NO user,
  // AND we are NOT on the login page, it's an unexpected state for a protected route.
  // AuthProvider should have redirected. This "Verifying session..." is a fallback.
  if (!authIsLoading && !user && pathname !== '/login') {
    console.warn(`AppLayout: Rendered on a protected page (${pathname}) with no user, and auth is not processing. AuthProvider should handle redirect.`);
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  // If we reach here, it means:
  // 1. authIsLoading is false.
  // 2. EITHER a user is present (typical for protected routes)
  // 3. OR user is null BUT pathname IS '/login' (AppLayout is rendering for the login page)
  // In both these valid scenarios, we proceed to render the main layout structure.
  // SidebarNav will correctly show no items if user is null (which is the case for /login).

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
              // Show Sign In button if no user and on login page (or other non-protected layout areas if any)
              pathname === '/login' && ( // Only show Sign In if actually on login page and no user
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
