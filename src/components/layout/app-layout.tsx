
'use client';

import type React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image'; // Import next/image
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
import { Bell, UserCircle, LogOut, Loader2, PanelLeft } from 'lucide-react'; // Landmark removed
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading: authIsLoadingGlobal, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await logout(); 
    toast({ title: "Signed Out", description: "You have been successfully signed out." });
    // Navigation to /login is handled by AuthContext's useEffect
  };
  
  const publicPages = ['/login', '/force-password-change', '/track-loan'];
  const isPublicPage = publicPages.some(p => pathname.startsWith(p));
  
  // Do not render the main layout for specified public pages
  if (isPublicPage && !user) {
    return <>{children}</>;
  }

  // This prevents rendering the layout while auth state is resolving or if user is not authenticated.
  // AuthProvider already handles showing a loading screen.
  if (authIsLoadingGlobal || !user) {
    return null; 
  }

  const SidebarCollapseControl = () => {
    const { toggleSidebar } = useSidebar();

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSidebar}
        className="w-full justify-start gap-2 group-data-[state=collapsed]:justify-center"
      >
        <PanelLeft className="h-4 w-4" />
        <span className="group-data-[state=collapsed]:hidden">Collapse</span>
      </Button>
    );
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarRail />
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image 
              src="https://play-lh.googleusercontent.com/HR87m6M2_7ZmPGrSp_MSlmfG5uyx94iYthItSzrmWVgFWkJ3FPTOYCLPw0F_ul4mYg" 
              alt="LoanFlow Logo" 
              width={32} 
              height={32}
              className="h-8 w-8 text-primary" // Keep similar sizing classes
            />
            <h1 className="text-xl font-semibold text-primary group-data-[state=expanded]:opacity-100 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:hidden transition-opacity duration-200">LoanFlow</h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarCollapseControl />
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
                    <span className="font-medium">{user.fullName}</span>
                    {user.customRoleName && <Badge variant="outline" className="ml-2 text-xs">{user.customRoleName}</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={authIsLoadingGlobal}>
                    {authIsLoadingGlobal && pathname === '/login' ? <Loader2 className="animate-spin mr-1 h-4 w-4" /> : <LogOut className="mr-1 h-4 w-4" />}
                     Sign Out
                  </Button>
                </div>
              </>
            ) : (
              pathname !== '/login' && (
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
