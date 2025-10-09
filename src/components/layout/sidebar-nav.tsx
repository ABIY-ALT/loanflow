
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
  Drama,
  Users2 as UsersIcon,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  requiredPermissions?: AppPermission[]; // Permissions needed to see this item
  subItems?: NavItemConfig[];
}

const navItemsConfig: NavItemConfig[] = [
  { 
    href: '/', 
    label: 'Dashboard', 
    icon: LayoutGrid,
    requiredPermissions: [PERMISSIONS.VIEW_DASHBOARD]
  },
  { 
    href: '/loan-process', 
    label: 'Loan Pipeline', 
    icon: KanbanSquare,
    requiredPermissions: [PERMISSIONS.VIEW_LOAN_PIPELINE]
  },
  {
    href: '/loan-requests/new',
    label: 'New Loan Request',
    icon: FilePlus2,
    requiredPermissions: [PERMISSIONS.CREATE_LOAN_REQUEST]
  },
  {
    href: '/my-assigned-cases',
    label: 'My Assigned Cases',
    icon: ClipboardList,
    requiredPermissions: [PERMISSIONS.VIEW_OWN_ASSIGNED_CASES]
  },
  {
    href: '/manager-review',
    label: 'Manager Review Queue',
    icon: UserCheck,
    requiredPermissions: [PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE]
  },
  {
    href: '/department-queue',
    label: 'Unassigned Cases',
    icon: FolderKanban,
    requiredPermissions: [PERMISSIONS.VIEW_UNASSIGNED_CASES_QUEUE]
  },
  { 
    href: '/loan-status', 
    label: 'Loan Status Lookup', 
    icon: SearchCheck,
    requiredPermissions: [PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP]
  },
  {
    href: '/overdue-tasks',
    label: 'Overdue Tasks',
    icon: AlertTriangle,
    requiredPermissions: [PERMISSIONS.VIEW_OVERDUE_TASKS_REPORT]
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    // A user needs at least one settings-related permission to see the main Settings link
    requiredPermissions: [
        PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS, 
        PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS,
        PERMISSIONS.MANAGE_SETTINGS_ROLES,
        PERMISSIONS.MANAGE_USERS, // Added for register user link if it's inside settings
    ], 
    subItems: [
      {
        href: '/settings/departments',
        label: 'Manage Departments',
        icon: Building,
        requiredPermissions: [PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS]
      },
      {
        href: '/settings/roles-management',
        label: 'Manage Roles',
        icon: Drama,
        requiredPermissions: [PERMISSIONS.MANAGE_SETTINGS_ROLES]
      },
      {
        href: '/settings/user-assignments',
        label: 'Manage User Assignments',
        icon: UsersIcon,
        requiredPermissions: [PERMISSIONS.MANAGE_USERS] // Or a more specific one if created
      },
      {
        href: '/settings/register-user', // Added link for user registration page
        label: 'Register New User',
        icon: FilePlus2, // Reusing icon, consider a UserPlus icon if available
        requiredPermissions: [PERMISSIONS.MANAGE_USERS] // Typically admin/user manager
      }
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

  const userPermissions = new Set(user.permissions || []);

  const canView = (itemRequiredPermissions?: AppPermission[]): boolean => {
    if (!itemRequiredPermissions || itemRequiredPermissions.length === 0) return true; // Public item or no specific permission needed beyond login

    // Check if user has AT LEAST ONE of the required permissions for the item
    return itemRequiredPermissions.some(permission => userPermissions.has(permission));
  };
  
  const visibleNavItems = navItemsConfig.filter(item => 
    canView(item.requiredPermissions)
  ).map(item => ({
      ...item,
      subItems: item.subItems?.filter(sub => canView(sub.requiredPermissions))
  }));


  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        
        const isActiveDirectly = currentPathname === item.href;
        const isActiveViaSubItem = item.subItems?.some(sub => currentPathname.startsWith(sub.href)) ?? false;
        const mainButtonIsActive = isActiveDirectly || isActiveViaSubItem;

        // Open sub-menu if the current path starts with the main item's href,
        // it has sub-items, and it's not the root dashboard page (which has no settings sub-menu).
        const openSubMenu = item.subItems && item.subItems.length > 0 && 
                            currentPathname.startsWith(item.href) && item.href !== '/';

        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref>
              <SidebarMenuButton
                isActive={mainButtonIsActive}
                className="justify-start"
                tooltip={item.label}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
            {openSubMenu && item.subItems && item.subItems.length > 0 && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  const subItemIsActive = currentPathname === subItem.href;
                  return (
                    <SidebarMenuItem key={subItem.href} className="list-none">
                       <Link href={subItem.href} passHref>
                         <SidebarMenuButton
                            isActive={subItemIsActive}
                            className="justify-start text-sm h-8"
                            tooltip={subItem.label}
                         >
                            <SubIcon className="h-4 w-4 mr-2.5" />
                            <span>{subItem.label}</span>
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
