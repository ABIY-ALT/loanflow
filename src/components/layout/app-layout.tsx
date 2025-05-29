
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
import { Bell, Landmark } from 'lucide-react'; // Removed LogIn, LogOut, Loader2 for auth
// Removed: import { useAuth } from '@/contexts/auth-context'; 
// Removed: import { signOut } from 'firebase/auth';
// Removed: import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  // Removed: const { user, isLoading: authIsLoading } = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();

  // Removed: handleSignOut function as Firebase auth is removed

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
            {/* Authentication related UI (user email, login/logout buttons) removed */}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
