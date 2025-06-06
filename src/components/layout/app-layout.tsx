
'use client';

import type React from 'react';
// Removed unused useEffect import
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
  const { user, isLoading: authIsProcessing, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter(); // Kept for general navigation if needed elsewhere
  const pathname = usePathname(); // To know current page

  const handleSignOut = () => {
    logout(); // AuthContext's useEffect will handle redirection to /login
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
  };


  if (authIsProcessing) {
    // This means login() or logout() in AuthContext is actively running.
    // AuthProvider should ideally show its own "Processing authentication..."
    // This is a fallback if AppLayout somehow renders during this specific state.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  if (!user) {
    // If auth is NOT processing, and there's NO user, it means AuthProvider should have
    // either redirected to /login or be showing its "Redirecting to login..." screen.
    // If AppLayout renders in this state, it's an unexpected situation on a protected route.
    console.warn(`AppLayout: Rendered with no user, and auth is not processing (pathname: ${pathname}). This may indicate an issue if not on /login. AuthProvider should handle redirects.`);
    // Displaying a generic "Verifying session..." which should be very brief if AuthProvider is working.
    // If this screen persists, there's a deeper issue in AuthProvider's redirection or state logic.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  // If we reach here, user is authenticated and auth is not actively processing.
  // Render the main application layout.
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
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
