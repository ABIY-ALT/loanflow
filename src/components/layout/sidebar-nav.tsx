
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
  Eye, // Added for VIEW_ONLY if we give it a specific icon
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
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  { 
    href: '/loan-requests/new', 
    label: 'New Loan Request', 
    icon: FilePlus2,
    roles: [UserRole.ADMIN, UserRole.RELATIONSHIP_MANAGER, UserRole.UNDERWRITER, UserRole.STAFF] // Not for VIEW_ONLY
  },
  {
    href: '/my-assigned-cases',
    label: 'My Assigned Cases',
    icon: ClipboardList,
    roles: [UserRole.STAFF, UserRole.RELATIONSHIP_MANAGER, UserRole.UNDERWRITER, UserRole.ADMIN] // Not for VIEW_ONLY
  },
  {
    href: '/manager-review',
    label: 'Manager Review Queue',
    icon: UserCheck,
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN] // Not for VIEW_ONLY or basic staff
  },
  {
    href: '/department-queue',
    label: 'Unassigned Cases',
    icon: FolderKanban,
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN] // Not for VIEW_ONLY or basic staff
  },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  {
    href: '/overdue-tasks',
    label: 'Overdue Tasks',
    icon: AlertTriangle,
    roles: [UserRole.UNDERWRITER, UserRole.RELATIONSHIP_MANAGER, UserRole.ADMIN] // Not for VIEW_ONLY or basic staff
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    roles: [UserRole.ADMIN, UserRole.UNDERWRITER], 
    subItems: [
      {
        href: '/settings/departments',
        label: 'Manage Departments',
        icon: Building,
        roles: [UserRole.ADMIN, UserRole.UNDERWRITER] 
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

  if (!user) {
    return null;
  }

  const userRole = user?.role;

  const canView = (itemRoles?: UserRole[]): boolean => {
    if (!userRole) return false; 
    if (!itemRoles || itemRoles.length === 0) return true; // Public item

    // VIEW_ONLY specific logic: only show items explicitly allowed for VIEW_ONLY or public items
    if (userRole === UserRole.VIEW_ONLY) {
        return itemRoles.includes(UserRole.VIEW_ONLY) || itemRoles.length === 0;
    }

    // For other roles (ADMIN, UNDERWRITER, STAFF, etc.)
    if (userRole === UserRole.ADMIN || userRole === UserRole.UNDERWRITER) { // ADMIN and UNDERWRITER are broader
        return true; 
    }
    return itemRoles.includes(userRole);
  };
  
  // Explicitly define what VIEW_ONLY can see if the generic `canView` is too broad
  const isViewOnlyUser = userRole === UserRole.VIEW_ONLY;
  const viewOnlyAllowedPaths = ['/', '/loan-process', '/loan-status'];


  const visibleNavItems = navItemsConfig.filter(item => {
    if (isViewOnlyUser) {
        return viewOnlyAllowedPaths.includes(item.href);
    }
    return canView(item.roles);
  });

  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const mainButtonIsActive = currentPathname === item.href;

        // Filter sub-items based on role, especially for VIEW_ONLY
        const filteredSubItems = item.subItems?.filter(sub => {
            if (isViewOnlyUser) {
                return viewOnlyAllowedPaths.includes(sub.href); // VIEW_ONLY generally won't have sub-items based on current config
            }
            return canView(sub.roles);
        });
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
