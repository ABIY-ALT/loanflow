
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
  History,
  Network,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from '@/components/ui/sidebar';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { getLoanRequests } from '@/services/loan-service-prisma';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  requiredPermissions?: AppPermission[];
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
    href: '/executive-overview',
    label: 'Executive Overview',
    icon: BarChartBig,
    requiredPermissions: [PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW]
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
    href: '/loan-requests/district',
    label: 'District Workflow',
    icon: Network,
    requiredPermissions: [
      PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
      PERMISSIONS.VIEW_DISTRICT_ANALYST_REVIEW,
      PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE,
      PERMISSIONS.VIEW_OWN_SUBMITTED_CASES,
      PERMISSIONS.APPROVE_COMMITTEE_CASES,
      PERMISSIONS.CREATE_LOAN_REQUEST,
    ],
    subItems: [
      {
        href: '/district/dashboard',
        label: 'District Dashboard',
        icon: BarChartBig,
        requiredPermissions: [PERMISSIONS.VIEW_DISTRICT_DASHBOARD],
      },
      {
        href: '/analyst/review',
        label: 'Analyst Review',
        icon: FileSearch,
        requiredPermissions: [PERMISSIONS.VIEW_DISTRICT_ANALYST_REVIEW]
      },
      {
        href: '/committee/approval',
        label: 'Committee Approval',
        icon: Users,
        requiredPermissions: [PERMISSIONS.APPROVE_COMMITTEE_CASES]
      },
      {
        href: '/district/manager-review',
        label: 'Manager Review (District)',
        icon: UserCheck,
        requiredPermissions: [PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE]
      },
      {
        href: '/district/submitted-cases',
        label: 'District Submissions',
        icon: FileOutput,
        requiredPermissions: [PERMISSIONS.VIEW_OWN_SUBMITTED_CASES]
      },
    ]
  },
  {
    href: '/valuation/incoming',
    label: 'District Valuation',
    icon: Building,
    requiredPermissions: [
      PERMISSIONS.VIEW_DISTRICT_VALUATION,
      PERMISSIONS.VIEW_INCOMING_CASES,
      PERMISSIONS.VIEW_MY_VALUATION_CASES,
      PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE,
    ],
    subItems: [
      {
        href: '/valuation/incoming',
        label: 'Valuation Queue',
        icon: Building,
        requiredPermissions: [PERMISSIONS.VIEW_DISTRICT_VALUATION, PERMISSIONS.VIEW_INCOMING_CASES]
      },
      {
        href: '/valuation/review',
        label: 'Valuation Review',
        icon: UserCheck,
        requiredPermissions: [PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE]
      },
      {
        href: '/valuation/my-cases',
        label: 'My Valuation',
        icon: ClipboardList,
        requiredPermissions: [PERMISSIONS.VIEW_MY_VALUATION_CASES]
      },
    ]
  },
  {
    href: '/my-assigned-cases',
    label: 'My Workspace',
    icon: ClipboardList,
    requiredPermissions: [
      PERMISSIONS.VIEW_OWN_ASSIGNED_CASES,
      PERMISSIONS.VIEW_OWN_SUBMITTED_CASES
    ],
    subItems: [
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
    ]
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
    requiredPermissions: []
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
  const { toast } = useToast();

  // Badge counts state
  const [counts, setCounts] = useState({
    incoming: 0,
    review: 0,
    assigned: 0,
    submitted: 0,
  });

  const prevIncomingCountRef = useRef<number>(0);

  const fetchCounts = useCallback(async (isInitial = false) => {
    if (!user) return;
    try {
      const result = await getLoanRequests();
      if (result && 'loans' in result && result.loans) {
        const loans = result.loans as LoanRequest[];

        // 1. Incoming (Unassigned cases in user's dept)
        const incoming = loans.filter((l: LoanRequest) =>
          l.assignedDepartment === user.department &&
          (l.assignedToUsers?.length || 0) === 0 &&
          !l.isReadyForManagerReview &&
          !l.isTerminalStage
        ).length;

        // 2. Manager Review (Ready for review in manager's dept)
        const review = loans.filter((l: LoanRequest) =>
          l.assignedDepartment === user.department &&
          l.isReadyForManagerReview === true &&
          !l.isTerminalStage
        ).length;

        // 3. My Assigned Cases (Specifically assigned to user AND not yet for review)
        const assigned = loans.filter((l: LoanRequest) =>
          l.assignedToUsers?.some((u: User) => u.id === user.id) &&
          !l.isReadyForManagerReview &&
          !l.isTerminalStage
        ).length;

        // 4. My Submitted Cases (Created by user and active)
        const submitted = loans.filter((l: LoanRequest) =>
          l.createdById === user.id &&
          !l.isTerminalStage
        ).length;

        // Trigger notification if incoming count increased
        if (!isInitial && incoming > prevIncomingCountRef.current && user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES)) {
          const diff = incoming - prevIncomingCountRef.current;
          toast({
            title: "New Incoming Cases",
            description: `${diff} new loan request(s) have arrived in the ${user.department} department.`,
            variant: "default",
          });
        }

        prevIncomingCountRef.current = incoming;
        setCounts({ incoming, review, assigned, submitted });
      }
    } catch (e) {
      console.error("Error fetching counts for sidebar", e);
    }
  }, [user, toast]);

  useEffect(() => {
    setIsClient(true);
    const parentMenu = navItemsConfig.find(item =>
      item.subItems?.some(sub => currentPathname.startsWith(sub.href))
    );
    if (parentMenu) {
      setOpenMenus(prev => new Set(prev).add(parentMenu.href));
    }

    fetchCounts(true);
    const interval = setInterval(() => fetchCounts(false), 30000);
    return () => clearInterval(interval);
  }, [currentPathname, fetchCounts]);

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

  const userPermissions = new Set(user?.permissions || []);

  const canView = (itemRequiredPermissions?: AppPermission[]): boolean => {
    if (!itemRequiredPermissions || itemRequiredPermissions.length === 0) return true;
    if (!user) return false;
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

  const getBadgeCount = (href: string) => {
    if (href === '/incoming-cases') return counts.incoming;
    if (href === '/manager-review') return counts.review;
    if (href === '/my-assigned-cases') return counts.assigned;
    if (href === '/my-submitted-cases') return counts.submitted;
    return 0;
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

        const count = getBadgeCount(item.href);

        return (
          <SidebarMenuItem key={`${item.href}-${item.label}`}>
            <SidebarMenuButton
              asChild
              isActive={mainButtonIsActive}
              className="justify-start w-full"
              tooltip={item.label}
            >
              <Link href={item.href} className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {count > 0 && (
                  <Badge
                    variant={item.href === '/incoming-cases' ? "destructive" : "secondary"}
                    className={cn(
                      "ml-auto h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full",
                      item.href === '/incoming-cases' && "bg-red-600 animate-pulse"
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
            {hasSubItems && (
              <SidebarMenuAction
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(item.href); }}
                className={cn("transition-transform duration-200", isMenuOpen && "rotate-180")}
              >
                <ChevronDown className="h-4 w-4" />
                <span className="sr-only">Toggle {item.label} sub-menu</span>
              </SidebarMenuAction>
            )}
            {hasSubItems && isMenuOpen && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems?.map(subItem => {
                  const SubIcon = subItem.icon;
                  const subItemIsActive = currentPathname.startsWith(subItem.href);
                  return (
                    <SidebarMenuItem key={`${item.href}-${subItem.href}-${subItem.label}`} className="list-none">
                      <SidebarMenuButton
                        asChild
                        isActive={subItemIsActive}
                        className="justify-start text-sm h-8"
                        tooltip={subItem.label}
                      >
                        <Link href={subItem.href}>
                          <SubIcon className="h-4 w-4 mr-2.5" />
                          <span>{subItem.label}</span>
                        </Link>
                      </SidebarMenuButton>
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
