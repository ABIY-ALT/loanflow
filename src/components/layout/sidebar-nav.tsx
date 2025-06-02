
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
  Building, // Icon for Manage Departments
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  { href: '/loan-requests/new', label: 'New Loan Request', icon: FilePlus2 },
  { href: '/manager-review', label: 'Manager Review Queue', icon: UserCheck },
  { href: '/department-queue', label: 'Unassigned Cases', icon: FolderKanban },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  { href: '/overdue-tasks', label: 'Overdue Tasks', icon: AlertTriangle },
  { href: '/settings/departments', label: 'Manage Departments', icon: Building }, // Now a top-level item
  { href: '/settings', label: 'Settings', icon: Settings,
    subItems: [
      // No sub-items for settings for now, or add other general settings pages here
      // Example: { href: '/settings/general', label: 'General Settings', icon: SettingsIconSub },
    ]
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        // Exact match for parent, startsWith for sub-items or general pages
        // For top-level items, exact match or if it's a base for sub-items.
        // For items without sub-items, direct match is fine.
        // For items with sub-items, check if pathname starts with item.href
        let isActive = pathname === item.href;
        if (item.subItems && item.subItems.length > 0 && pathname.startsWith(item.href) && pathname !== item.href) {
            // Parent is active if a sub-item is active but not if it's the parent itself, unless no sub-item is active
             isActive = true; // Keep parent highlighted if any sub-item is active
        }


        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <SidebarMenuButton
                asChild
                isActive={isActive && (!item.subItems || item.subItems.length === 0 || pathname === item.href)} // Highlight parent only if it's the direct page or no subs
                className={cn(
                  'justify-start',
                  (isActive && (!item.subItems || item.subItems.length === 0 || pathname === item.href)) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                )}
                tooltip={item.label}
              >
                <a>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
            {item.subItems && item.subItems.length > 0 && pathname.startsWith(item.href) && ( // Show sub-items if parent path matches
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  const isSubActive = pathname === subItem.href;
                  return (
                    <SidebarMenuItem key={subItem.href} className="list-none">
                       <Link href={subItem.href} legacyBehavior passHref>
                         <SidebarMenuButton
                            asChild
                            isActive={isSubActive}
                            className={cn(
                                'justify-start text-sm h-8', // Smaller for sub-items
                                isSubActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                                !isSubActive && 'hover:bg-sidebar-accent/70'
                            )}
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
