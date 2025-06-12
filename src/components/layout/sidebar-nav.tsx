
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
  Drama,
  UserIcon
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@/types/loan'; // UserRole enum for comparison

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: (UserRole | string)[]; // Allow string for JWT roles
  subItems?: NavItemConfig[];
}

// UserRole enum values for easier comparison with JWT roles (which are strings)
const ROLES_FROM_ENUM = {
  ADMIN: UserRole.ADMIN.toString(), // "Admin"
  RELATIONSHIP_MANAGER: UserRole.RELATIONSHIP_MANAGER.toString(),
  UNDERWRITER: UserRole.UNDERWRITER.toString(),
  STAFF: UserRole.STAFF.toString(),
  VIEW_ONLY: UserRole.VIEW_ONLY.toString(),
};


const navItemsConfig: NavItemConfig[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  {
    href: '/loan-requests/new',
    label: 'New Loan Request',
    icon: FilePlus2,
    roles: [ROLES_FROM_ENUM.ADMIN, "User", ROLES_FROM_ENUM.RELATIONSHIP_MANAGER, ROLES_FROM_ENUM.UNDERWRITER, ROLES_FROM_ENUM.STAFF]
  },
  {
    href: '/my-assigned-cases',
    label: 'My Assigned Cases',
    icon: ClipboardList,
    roles: [ROLES_FROM_ENUM.STAFF, ROLES_FROM_ENUM.RELATIONSHIP_MANAGER, ROLES_FROM_ENUM.UNDERWRITER, ROLES_FROM_ENUM.ADMIN]
  },
  {
    href: '/manager-review',
    label: 'Manager Review Queue',
    icon: UserCheck,
    roles: [ROLES_FROM_ENUM.UNDERWRITER, ROLES_FROM_ENUM.ADMIN]
  },
  {
    href: '/department-queue',
    label: 'Unassigned Cases',
    icon: FolderKanban,
    roles: [ROLES_FROM_ENUM.UNDERWRITER, ROLES_FROM_ENUM.ADMIN]
  },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  {
    href: '/overdue-tasks',
    label: 'Overdue Tasks',
    icon: AlertTriangle,
    roles: [ROLES_FROM_ENUM.UNDERWRITER, ROLES_FROM_ENUM.RELATIONSHIP_MANAGER, ROLES_FROM_ENUM.ADMIN]
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    roles: [ROLES_FROM_ENUM.ADMIN, ROLES_FROM_ENUM.UNDERWRITER],
    subItems: [
      {
        href: '/settings/departments',
        label: 'Manage Departments',
        icon: Building,
        roles: [ROLES_FROM_ENUM.ADMIN]
      },
      {
        href: '/settings/roles-management',
        label: 'Manage Roles',
        icon: Drama,
        roles: [ROLES_FROM_ENUM.ADMIN]
      },
      {
        href: '/settings/user-assignments', // New page
        label: 'Manage User Assignments',
        icon: UserIcon,
        roles: [ROLES_FROM_ENUM.ADMIN]
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
    return null; // No user, no sidebar nav items (except potentially public ones if any)
  }

  const currentUserRoleString = String(user.role); // Role from JWT is a string

  const canView = (itemRoles?: (UserRole | string)[]): boolean => {
    if (!currentUserRoleString) return false;
    if (!itemRoles || itemRoles.length === 0) return true; // Public item

    // Admin sees everything
    if (currentUserRoleString === ROLES_FROM_ENUM.ADMIN) return true;

    // For VIEW_ONLY, it's a specific check, not general visibility.
    // This will be handled by the viewOnlyAllowedPaths for now.
    // A more robust permission system would be based on specific permissions, not just role names.
    
    return itemRoles.includes(currentUserRoleString);
  };

  const isViewOnlyUser = currentUserRoleString === ROLES_FROM_ENUM.VIEW_ONLY;
  const viewOnlyAllowedPaths = ['/', '/loan-process', '/loan-status', '/loan-requests']; // Added /loan-requests for detail view

  const visibleNavItems = navItemsConfig.filter(item => {
    if (isViewOnlyUser) {
      // VIEW_ONLY can see specific paths, and loan detail pages (which start with /loan-requests/)
      return viewOnlyAllowedPaths.some(allowedPath => item.href === allowedPath || (allowedPath === '/loan-requests' && item.href.startsWith('/loan-requests/')));
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
                // VIEW_ONLY generally doesn't see settings sub-items
                return false;
            }
            return canView(sub.roles);
        });
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
