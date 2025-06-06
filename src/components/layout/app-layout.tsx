
'use client';

import type React from 'react';
import { useEffect } from 'react'; // Keep useEffect import
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
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
  const { user, isLoading: authIsLoading, logout } = useAuth(); // Renamed isLoading for clarity
  const { toast } = useToast();
  const router = useRouter(); // Kept for potential future use, not for logout redirect
  const pathname = usePathname();

  const handleSignOut = () => {
    logout(); // AuthContext's useEffect will handle redirection to /login
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
  };

  // If AuthContext is actively processing something (initial load or login/logout action)
  if (authIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // If AuthContext is done loading, but there's no user,
  // AuthProvider should have already redirected to /login or shown its own "Redirecting..." loader.
  // If AppLayout still renders in this state, it's an unexpected situation.
  // This usually means AppLayout is wrapping a page it shouldn't (like /login)
  // or there's a timing issue in the redirect logic.
  if (!user) {
    console.warn(`AppLayout: Rendered with no user, and AuthContext is not loading (pathname: ${pathname}). AuthProvider should handle this. Displaying fallback loader.`);
    // Display a generic loader; AuthProvider is responsible for the actual redirect.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  // If we reach here, user is authenticated and authIsLoading is false.
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
