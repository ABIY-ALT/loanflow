
'use client'; 

import type React from 'react';
import { useRouter } from 'next/navigation';
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
  const { user, isLoading, logout } = useAuth(); // Destructure directly
  const { toast } = useToast();
  const router = useRouter(); // Kept for the manual sign-in button if needed

  const handleSignOut = () => {
    logout(); // AuthContext's useEffect will handle redirection to /login
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
  };

  // AuthProvider is the main gate. AppLayout should only render if:
  // 1. AuthContext's isLoading is false (initial load and auth processes are done).
  // 2. AuthContext's user is non-null (because AppLayout is for protected routes).

  if (isLoading) {
    // This loader handles cases where AppLayout might render while AuthContext's
    // isLoading state is true (e.g., during the login() call).
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  if (!user) {
    // This state should ideally be prevented by AuthProvider's redirection logic
    // if AppLayout is used for routes other than '/login'.
    // If this is reached, it indicates a potential issue or that AuthProvider's redirect hasn't completed.
    // Returning a loader or null is a safe fallback.
    console.warn("AppLayout rendered without a user. AuthProvider should have redirected to /login if not on /login.");
    return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
            <Loader2 className="h-12 w-12 animate-spin text-destructive mb-4" />
            <p className="text-lg text-destructive">Authentication state error. Please wait...</p>
        </div>
    );
  }

  // If we reach here, 'user' is non-null and 'isLoading' (from AuthContext) is false.
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
          <SidebarNav /> {/* SidebarNav uses useAuth() internally */}
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
            {/* 'user' is guaranteed to be non-null here due to the checks above */}
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
