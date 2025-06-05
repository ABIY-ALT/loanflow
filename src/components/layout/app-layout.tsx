
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
  const authContext = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = () => {
    authContext.logout(); // This will now handle the redirection
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
  };
  
  // If not authenticated and not on the login page, redirect to login
  // This basic client-side protection can be enhanced.
  useEffect(() => {
    if (!authContext.isLoading && !authContext.user && window.location.pathname !== '/login') {
      router.replace('/login');
    }
  }, [authContext.isLoading, authContext.user, router]);

  // If still loading auth state, or if no user and trying to access protected content, show loader or nothing.
  // The useEffect above will handle redirection.
  if (authContext.isLoading || (!authContext.user && window.location.pathname !== '/login')) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background z-50">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Loading session...</p>
        </div>
      );
  }


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
            {authContext.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : authContext.user ? (
                <div className="flex items-center gap-2">
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                    <div className="text-sm">
                        <span className="font-medium">{authContext.user.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{authContext.user.role}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                        <LogOut className="mr-1 h-4 w-4" /> Sign Out
                    </Button>
                </div>
            ) : (
                 <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
                    Sign In
                </Button>
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
