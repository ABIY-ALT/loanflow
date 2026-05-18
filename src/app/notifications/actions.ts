'use server';

import {
  getUserNotifications as getUserNotificationsImpl,
  markNotificationRead as markNotificationReadImpl,
  markAllNotificationsRead as markAllNotificationsReadImpl,
} from '@/services/notification-service';

export async function getUserNotifications(limit?: number) {
  return getUserNotificationsImpl(limit);
}

export async function markNotificationRead(notificationId: string) {
  return markNotificationReadImpl(notificationId);
}

export async function markAllNotificationsRead() {
  return markAllNotificationsReadImpl();
}
