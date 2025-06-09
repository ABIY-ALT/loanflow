
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
  Eye, 
  Drama, // Icon for Role Management
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
  roles?: UserRole[]; 
  subItems?: NavItemConfig[];
}

const navItemsConfig: NavItemConfig[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  { 
    href: '/loan-requests/new', 
    label: 'New Loan Request', 
    icon: FilePlus2,
    roles: [UserRole.ADMIN, UserRole.RELATIONSHIP_MANAGER, UserRole.UNDERWRITER, UserRole.STAFF]
  },
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
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN] 
  },
  {
    href: '/department-queue',
    label: 'Unassigned Cases',
    icon: FolderKanban,
    roles: [UserRole.UNDERWRITER, UserRole.ADMIN]
  },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  {
    href: '/overdue-tasks',
    label: 'Overdue Tasks',
    icon: AlertTriangle,
    roles: [UserRole.UNDERWRITER, UserRole.RELATIONSHIP_MANAGER, UserRole.ADMIN]
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
        roles: [UserRole.ADMIN] // Typically Admin only
      },
      {
        href: '/settings/roles-management', // New page link
        label: 'Manage Roles',
        icon: Drama, // Using Drama icon for roles
        roles: [UserRole.ADMIN] // Admin only
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
    if (!itemRoles || itemRoles.length === 0) return true; 

    if (userRole === UserRole.VIEW_ONLY) {
        return itemRoles.includes(UserRole.VIEW_ONLY) || itemRoles.length === 0;
    }
    // Admin and Underwriter can see more items by default if not explicitly restricted
    if (userRole === UserRole.ADMIN) return true; // Admin sees everything
    if (userRole === UserRole.UNDERWRITER && (itemRoles.includes(UserRole.UNDERWRITER) || itemRoles.includes(UserRole.STAFF) || itemRoles.includes(UserRole.RELATIONSHIP_MANAGER) )) return true;

    return itemRoles.includes(userRole);
  };
  
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
        
        const isActiveDirectly = currentPathname === item.href;
        const isActiveViaSubItem = item.subItems?.some(sub => currentPathname.startsWith(sub.href)) ?? false;
        const mainButtonIsActive = isActiveDirectly || isActiveViaSubItem;

        const filteredSubItems = item.subItems?.filter(sub => {
            if (isViewOnlyUser) {
                return viewOnlyAllowedPaths.includes(sub.href);
            }
            return canView(sub.roles);
        });
        // Determine if the submenu should be open: if the parent item's path is a prefix of the current path,
        // AND there are visible sub-items.
        const openSubMenu = filteredSubItems && filteredSubItems.length > 0 && currentPathname.startsWith(item.href) && item.href !== '/';


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
