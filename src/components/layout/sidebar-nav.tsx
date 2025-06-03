
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FilePlus2,
  SearchCheck,
  Settings as SettingsIcon, // Renamed to avoid conflict
  KanbanSquare,
  AlertTriangle,
  UserCheck,
  FolderKanban,
  Building,
  ClipboardList, // Corrected: Replaced ClipboardUser with ClipboardList
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/loan-process', label: 'Loan Pipeline', icon: KanbanSquare },
  { href: '/loan-requests/new', label: 'New Loan Request', icon: FilePlus2 },
  { href: '/my-assigned-cases', label: 'My Assigned Cases', icon: ClipboardList }, // Corrected: Used ClipboardList
  { href: '/manager-review', label: 'Manager Review Queue', icon: UserCheck },
  { href: '/department-queue', label: 'Unassigned Cases', icon: FolderKanban },
  { href: '/loan-status', label: 'Loan Status Lookup', icon: SearchCheck },
  { href: '/overdue-tasks', label: 'Overdue Tasks', icon: AlertTriangle },
  {
    href: '/settings', 
    label: 'Settings',
    icon: SettingsIcon,
    subItems: [
      { href: '/settings/departments', label: 'Manage Departments', icon: Building },
      // Future settings sub-items can be added here
    ],
  },
];

export default function SidebarNav() {
  const [isClient, setIsClient] = useState(false);
  // Call hooks at the top level
  const currentPathname = usePathname();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render nothing on the server and during the first client render pass.
    // This ensures server-render is minimal and won't mismatch client-side dynamic content.
    return null;
  }

  // Now isClient is true, use currentPathname for rendering logic.
  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        // The button for the main item is active only if its href is an exact match.
        const mainButtonIsActive = currentPathname === item.href;
        
        // Determine if the submenu should be open (if a sub-item is active or the main item's page itself is active and it has subitems)
        const openSubMenu = item.subItems && item.subItems.length > 0 && currentPathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <SidebarMenuButton
                asChild
                isActive={mainButtonIsActive} // Main button active only on direct match
                className="justify-start"
                tooltip={item.label}
              >
                <a>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
            {/* Render sub-items if they exist AND the sub-menu should be open */}
            {openSubMenu && (
              <ul className="pl-4 mt-1 space-y-1 border-l border-sidebar-border ml-4">
                {item.subItems!.map(subItem => { // Added ! because openSubMenu implies item.subItems exists
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
