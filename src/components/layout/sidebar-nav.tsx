
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FilePlus2,
  SearchCheck,
  Settings as SettingsIcon, 
  KanbanSquare,
  AlertTriangle,
  UserCheck,
  FolderKanban,
  Building,
  ClipboardList, 
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@/types/loan';

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[]; // Roles that can see this item. If undefined, all roles see it.
  subItems?: NavItemConfig[];
}

const navItemsConfig: NavItemConfig[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid }, // All roles
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare }, // All roles
  { href: '/loan-requests/new', label: 'New Loan Request', icon: FilePlus2 }, // All roles
  { 
    href: '/my-assigned-cases', 
    label: 'My Assigned Cases', 
    icon: ClipboardList,
    roles: [UserRole.STAFF, UserRole.RELATIONSHIP_MANAGER, UserRole.UNDERWRITER, UserRole.ADMIN] 
  },
  { 
    href: '/manager-review', 
    label: 'Manager Review Queue', 
    icon: UserCheck,
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN] // Typically manager roles
  },
  { 
    href: '/department-queue', 
    label: 'Unassigned Cases', 
    icon: FolderKanban,
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN] // Typically manager roles
  },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck }, // All roles
  { 
    href: '/overdue-tasks', 
    label: 'Overdue Tasks', 
    icon: AlertTriangle,
    roles: [UserRole.UNDERWRITER, UserRole.RELATIONSHIP_MANAGER, UserRole.ADMIN] // Roles that manage queues or overview
  },
  {
    href: '/settings', 
    label: 'Settings',
    icon: SettingsIcon,
    roles: [UserRole.ADMIN], // ADMIN only
    subItems: [
      { 
        href: '/settings/departments', 
        label: 'Manage Departments', 
        icon: Building,
        roles: [UserRole.ADMIN] // ADMIN only
      },
    ],
  },
];

export default function SidebarNav() {
  const [isClient, setIsClient] = useState(false);
  const currentPathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || authLoading) {
    // Optionally show loading skeletons for nav items
    return (
        <SidebarMenu>
            {[...Array(6)].map((_, i) => (
                <SidebarMenuItem key={`skel-${i}`} className="p-2">
                    <div className="h-8 w-full bg-muted/50 animate-pulse rounded-md" />
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
  }

  const userRole = user?.role;

  const canView = (itemRoles?: UserRole[]): boolean => {
    if (!itemRoles || itemRoles.length === 0) return true; // No specific roles defined, visible to all
    if (!userRole) return false; // No user role, cannot view restricted items
    return itemRoles.includes(userRole);
  };

  const visibleNavItems = navItemsConfig.filter(item => canView(item.roles));

  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => {
        if (!canView(item.roles)) return null;

        const Icon = item.icon;
        const mainButtonIsActive = currentPathname === item.href;
        
        const filteredSubItems = item.subItems?.filter(sub => canView(sub.roles));
        const openSubMenu = filteredSubItems && filteredSubItems.length > 0 && currentPathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <SidebarMenuButton
                asChild
                isActive={mainButtonIsActive}
                className="justify-start"
                tooltip={item.label}
              >
                <a>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
            {openSubMenu && filteredSubItems && filteredSubItems.length > 0 && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {filteredSubItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  const subItemIsActive = currentPathname === subItem.href;
                  return (
                    <SidebarMenuItem key={subItem.href} className="list-none">
                       <Link href={subItem.href} legacyBehavior passHref>
                         <SidebarMenuButton
                            asChild
                            isActive={subItemIsActive}
                            className="justify-start text-sm h-8"
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
