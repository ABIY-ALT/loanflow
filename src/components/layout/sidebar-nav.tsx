
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FilePlus2,
  SearchCheck,
  Settings,
  KanbanSquare,
  AlertTriangle,
  UserCheck,
  FolderKanban,
  Building,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
// cn utility is not strictly needed here anymore since classNames are static
// import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  { href: '/loan-requests/new', label: 'New Loan Request', icon: FilePlus2 },
  { href: '/manager-review', label: 'Manager Review Queue', icon: UserCheck },
  { href: '/department-queue', label: 'Unassigned Cases', icon: FolderKanban },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  { href: '/overdue-tasks', label: 'Overdue Tasks', icon: AlertTriangle },
  { href: '/settings/departments', label: 'Manage Departments', icon: Building },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render null on the server and during the first client render pass.
    // The actual content will be rendered on the client after hydration.
    return null;
  }

  // Now that we are on the client, `pathname` from `usePathname()` is reliable.
  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        const buttonIsActive = pathname === item.href;

        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <SidebarMenuButton
                asChild
                isActive={buttonIsActive}
                className="justify-start" // Static className
                tooltip={item.label}
              >
                <a>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
            {/* Sub-item rendering logic - ensure pathname is used here too */}
            {item.subItems && item.subItems.length > 0 && pathname.startsWith(item.href) && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  const isSubActive = pathname === subItem.href; // Use consistent pathname
                  return (
                    <SidebarMenuItem key={subItem.href} className="list-none">
                       <Link href={subItem.href} legacyBehavior passHref>
                         <SidebarMenuButton
                            asChild
                            isActive={isSubActive}
                            className="justify-start text-sm h-8" // Static className
                            tooltip={subItem.label}
                         >
                            <a>
                                <SubIcon className="h-4 w-4 mr-2.5" />
                                <span>{subItem.label}</span>
                            </a>
                         </SidebarMenuButton>
                       </Link>
                    </SidebarMenuItem>
                  );
                })}
              </ul>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
