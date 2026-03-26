
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
  BarChartBig,
  Users,
  Map,
  FileSearch,
  ChevronDown,
  FileOutput,
  BellRing,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { getLoanRequests } from '@/services/loan-service-prisma';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  requiredPermissions?: AppPermission[]; // Permissions needed to see this item
  subItems?: NavItemConfig[];
  badgeCount?: number;
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
    href: '/customers',
    label: 'Customers',
    icon: Users,
    requiredPermissions: [PERMISSIONS.VIEW_CUSTOMERS]
  },
  {
    href: '/incoming-cases',
    label: 'Incoming Cases',
    icon: BellRing,
    requiredPermissions: [PERMISSIONS.VIEW_INCOMING_CASES]
  },
  {
    href: '/my-assigned-cases',
    label: 'My Assigned Cases',
    icon: ClipboardList,
    requiredPermissions: [PERMISSIONS.VIEW_OWN_ASSIGNED_CASES]
  },
  {
    href: '/my-submitted-cases',
    label: 'My Submitted Cases',
    icon: FileOutput,
    requiredPermissions: [PERMISSIONS.VIEW_OWN_SUBMITTED_CASES]
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
    label: 'Internal Status Lookup', 
    icon: SearchCheck,
    requiredPermissions: [PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP]
  },
   {
    href: '/track-loan',
    label: 'Public Loan Tracker',
    icon: FileSearch,
    requiredPermissions: [] // Public page, but shown to logged-in users for convenience
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: BarChartBig,
    requiredPermissions: [PERMISSIONS.VIEW_REPORTS]
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
    requiredPermissions: [
        PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS, 
        PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS,
        PERMISSIONS.MANAGE_SETTINGS_BRANCHES,
        PERMISSIONS.MANAGE_SETTINGS_ROLES,
        PERMISSIONS.MANAGE_USERS,
    ], 
    subItems: [
      {
        href: '/settings/departments',
        label: 'Manage Departments',
        icon: Building,
        requiredPermissions: [PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS]
      },
      {
        href: '/settings/branches',
        label: 'Manage Branches',
        icon: Map,
        requiredPermissions: [PERMISSIONS.MANAGE_SETTINGS_BRANCHES]
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
        requiredPermissions: [PERMISSIONS.MANAGE_USERS]
      },
      {
        href: '/settings/register-user',
        label: 'Register New User',
        icon: FilePlus2,
        requiredPermissions: [PERMISSIONS.MANAGE_USERS]
      }
    ],
  },
];

export default function SidebarNav() {
  const [isClient, setIsClient] = useState(false);
  const currentPathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [incomingCount, setIncomingCount] = useState(0);
  const { toast } = useToast();
  
  // Use a ref to track the previous count without triggering re-renders
  const prevCountRef = useRef<number>(0);

  const fetchIncomingCount = useCallback(async (isInitial = false) => {
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES)) return;
    try {
      const result = await getLoanRequests();
      if (result.loans && user.department) {
        const currentIncomingLoans = result.loans.filter(loan => 
          loan.assignedDepartment === user.department && 
          loan.assignedToUsers.length === 0 && 
          !loan.isReadyForManagerReview
        );
        
        const newCount = currentIncomingLoans.length;
        
        // Trigger notification if count increased
        if (!isInitial && newCount > prevCountRef.current) {
          const diff = newCount - prevCountRef.current;
          toast({
            title: "New Incoming Cases",
            description: `${diff} new loan request(s) have arrived in the ${user.department} department.`,
            variant: "default",
          });
        }
        
        prevCountRef.current = newCount;
        setIncomingCount(newCount);
      }
    } catch (e) {
      console.error("Error fetching incoming count for sidebar", e);
    }
  }, [user, toast]);

  useEffect(() => {
    setIsClient(true);
    // Auto-open parent menu if on a sub-item page
    const parentMenu = navItemsConfig.find(item => 
        item.subItems?.some(sub => currentPathname.startsWith(sub.href))
    );
    if (parentMenu) {
        setOpenMenus(prev => new Set(prev).add(parentMenu.href));
    }
    
    // Initial fetch
    fetchIncomingCount(true);
    
    // Polling interval: 30 seconds for better perceived "real-time" responsiveness
    const interval = setInterval(() => fetchIncomingCount(false), 30000); 
    return () => clearInterval(interval);
  }, [currentPathname, fetchIncomingCount]);

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

  // Hide nav if user is not logged in and not on a public page
  const publicPaths = ['/track-loan'];
  const isPublicPage = publicPaths.some(p => currentPathname.startsWith(p));
  if (!user && !isPublicPage) {
    return null;
  }
  
  if (!user && isPublicPage) {
     return null; // Don't show sidebar on public pages for non-logged in users
  }


  const userPermissions = new Set(user?.permissions || []);

  const canView = (itemRequiredPermissions?: AppPermission[]): boolean => {
    if (!itemRequiredPermissions || itemRequiredPermissions.length === 0) return true; // Public items
    if (!user) return false; // Must be logged in for permissioned items
    return itemRequiredPermissions.some(permission => userPermissions.has(permission));
  };
  
  const visibleNavItems = navItemsConfig.filter(item => 
    canView(item.requiredPermissions)
  ).map(item => ({
      ...item,
      subItems: item.subItems?.filter(sub => canView(sub.requiredPermissions))
  }));

  const toggleMenu = (href: string) => {
    setOpenMenus(prev => {
        const newSet = new Set(prev);
        if (newSet.has(href)) {
            newSet.delete(href);
        } else {
            newSet.add(href);
        }
        return newSet;
    });
  };

  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isActiveDirectly = currentPathname === item.href;
        const isActiveViaSubItem = item.subItems?.some(sub => currentPathname.startsWith(sub.href)) ?? false;
        const mainButtonIsActive = isActiveDirectly || isActiveViaSubItem;
        const isMenuOpen = openMenus.has(item.href);
        
        // Handle badge for Incoming Cases
        const showBadge = item.href === '/incoming-cases' && incomingCount > 0;

        const buttonContent = (
          <SidebarMenuButton
            isActive={mainButtonIsActive}
            className="justify-start w-full pr-0"
            tooltip={item.label}
          >
            <Link href={item.href} className="flex items-center gap-2 flex-grow" passHref>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {showBadge && (
                <Badge variant="destructive" className="ml-auto mr-2 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full bg-red-600 animate-pulse">
                  {incomingCount}
                </Badge>
              )}
            </Link>
            {hasSubItems && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-auto shrink-0"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(item.href); }}
              >
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isMenuOpen && "rotate-180")} />
              </Button>
            )}
          </SidebarMenuButton>
        );

        return (
          <SidebarMenuItem key={item.href}>
            {buttonContent}
            {hasSubItems && isMenuOpen && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems?.map(subItem => {
                  const SubIcon = subItem.icon;
                  const subItemIsActive = currentPathname.startsWith(subItem.href);
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
