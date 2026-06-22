import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/app/auth/actions';
import { formatISO } from 'date-fns';

const createErrorResult = (message: string, context?: string, originalError?: unknown): { error: string } => {
  if (originalError !== undefined) {
    console.error(`[NotificationService:${context || 'Unknown'}] Error: ${message}`, originalError);
  } else {
    console.error(`[NotificationService:${context || 'Unknown'}] Error: ${message}`);
  }
  return { error: message };
};

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  loanRequestId?: string;
  loanNumber?: string;
  readAt?: string;
  createdAt: string;
}

type Tx = Prisma.TransactionClient;

export async function createCaseAssignedNotifications(
  tx: Tx,
  params: {
    loanRequestId: string;
    loanNumber: string;
    customerName?: string;
    assigneeIds: string[];
    assignedByUserId: string;
    assignedByName: string;
  }
): Promise<void> {
  const recipients = [...new Set(params.assigneeIds)].filter(
    (id) => id && id !== params.assignedByUserId
  );
  if (recipients.length === 0) return;

  const caseLabel = params.customerName
    ? `${params.loanNumber} (${params.customerName})`
    : params.loanNumber;

  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: 'CASE_ASSIGNED',
      title: 'Case assigned to you',
      message: `${caseLabel} was assigned to you by ${params.assignedByName}.`,
      loanRequestId: params.loanRequestId,
    })),
  });
}

export async function getUserNotifications(limit = 30): Promise<{
  notifications?: AppNotification[];
  unreadCount?: number;
  error?: string;
}> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult('Unauthorized', 'getUserNotifications');

    const [records, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          loanRequest: { select: { loanNumber: true } },
        },
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      notifications: records.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        loanRequestId: n.loanRequestId || undefined,
        loanNumber: n.loanRequest?.loanNumber,
        readAt: n.readAt ? formatISO(n.readAt) : undefined,
        createdAt: formatISO(n.createdAt),
      })),
    };
  } catch (e: unknown) {
    return createErrorResult('Failed to load notifications.', 'getUserNotifications', e);
  }
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult('Unauthorized', 'markNotificationRead');

    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      return createErrorResult('Notification not found.', 'markNotificationRead');
    }
    return { success: true };
  } catch (e: unknown) {
    return createErrorResult('Failed to mark notification as read.', 'markNotificationRead', e);
  }
}

export async function markAllNotificationsRead(): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult('Unauthorized', 'markAllNotificationsRead');

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  } catch (e: unknown) {
    return createErrorResult('Failed to mark notifications as read.', 'markAllNotificationsRead', e);
  }
}
