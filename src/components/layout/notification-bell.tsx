'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/services/notification-service';
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/notifications/actions';

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    const result = await getUserNotifications();
    if (result.notifications) {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount ?? 0);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  const handleMarkRead = async (notification: AppNotification) => {
    if (notification.readAt) return;
    const result = await markNotificationRead(notification.id);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.preventDefault();
                void handleMarkAllRead();
              }}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;
              const href = notification.loanRequestId
                ? `/loan-requests/${notification.loanRequestId}`
                : '/my-assigned-cases';

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-0.5 p-3 focus:bg-accent',
                    isUnread && 'bg-primary/5'
                  )}
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleMarkRead(notification);
                    setOpen(false);
                  }}
                  asChild
                >
                  <Link href={href}>
                    <span className="text-sm font-medium leading-tight">{notification.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">{notification.message}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
