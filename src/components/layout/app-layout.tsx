import type React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';
import { Button } from '@/components/ui/button';
import { Bell, Landmark, UserCircle } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold text-primary">LoanFlow</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-4">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <UserCircle className="h-5 w-5" />
            Profile
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex items-center gap-4 ml-auto">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
            {/* Optional: Theme toggle or user menu can go here */}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
