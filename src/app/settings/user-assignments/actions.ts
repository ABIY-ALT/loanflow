

'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions'; 

export interface UserForAssignment {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
}

export interface AssignableData {
  departments: { id: string; name: string }[];
  customRoles: { id: string; name: string }[];
}

export interface UserAssignmentUpdatePayload {
  departmentId?: string | null;
  customRoleId?: string | null;
}

const createErrorReturn = (message: string, context?: string, originalError?: any): { success: boolean; error: string; statusCode: number } => {
  const genericMessage = 'An unexpected server error occurred. Please try again later.';
  console.error(`[UserAssignmentsActions:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { success: false, error: genericMessage, statusCode: 500 };
};

const createClientErrorReturn = (message: string, statusCode = 400): { success: boolean; error: string; statusCode: number } => {
    return { success: false, error: message, statusCode: statusCode };
}


export async function getUsersForAssignment(): Promise<{ users?: UserForAssignment[]; error?: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { error: "Unauthorized: You do not have permission to view user data." };
    }

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        department: true,
        customRole: true,
      },
    });

    const mappedUsers: UserForAssignment[] = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      departmentId: u.departmentId,
      departmentName: u.department?.name || null,
      customRoleId: u.customRoleId,
      customRoleName: u.customRole?.name || null,
    }));

    return { users: mappedUsers };
  } catch (e: any) {
    const { error } = createErrorReturn("Failed to fetch users.", "getUsersForAssignment", e);
    return { error };
  }
}

export async function getAssignableData(): Promise<{ data?: AssignableData; error?: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { error: "Unauthorized: You do not have permission to view assignment data." };
    }

    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const customRoles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return { data: { departments, customRoles } };
  } catch (e: any) {
    const { error } = createErrorReturn("Failed to fetch assignable data.", "getAssignableData", e);
    return { error };
  }
}

export async function updateUserAssignments(
  userId: string,
  data: UserAssignmentUpdatePayload
): Promise<{ success: boolean; error?: string; user?: UserForAssignment }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return createClientErrorReturn("Unauthorized: You do not have permission to update users.", 403);
    }

    if (!userId) {
      return createClientErrorReturn("User ID is required.", 400);
    }

    const updateData: any = {};

    if (data.hasOwnProperty('departmentId')) {
      if (data.departmentId === null || data.departmentId === "none") {
        updateData.departmentId = null;
      } else if (data.departmentId) {
        const deptExists = await prisma.department.findUnique({ where: { id: data.departmentId } });
        if (!deptExists) return createClientErrorReturn(`Department not found.`, 400);
        updateData.departmentId = data.departmentId;
      }
    }

    if (data.hasOwnProperty('customRoleId')) {
      if (data.customRoleId === null || data.customRoleId === "none") {
        updateData.customRoleId = null;
      } else if (data.customRoleId) {
        const roleExists = await prisma.role.findUnique({ where: { id: data.customRoleId } });
        if (!roleExists) return createClientErrorReturn(`Custom role not found.`, 400);
        updateData.customRoleId = data.customRoleId;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
        return createClientErrorReturn("No changes provided for update.", 400);
    }
    updateData.updatedAt = new Date();


    const updatedUserPrisma = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        department: true,
        customRole: true,
      },
    });

    const mappedUser: UserForAssignment = {
      id: updatedUserPrisma.id,
      name: updatedUserPrisma.name,
      email: updatedUserPrisma.email,
      departmentId: updatedUserPrisma.departmentId,
      departmentName: updatedUserPrisma.department?.name || null,
      customRoleId: updatedUserPrisma.customRoleId,
      customRoleName: updatedUserPrisma.customRole?.name || null,
    };

    return { success: true, user: mappedUser };
  } catch (e: any) {
    if (e.code === 'P2025') {
        const { error } = createErrorReturn(`User not found.`, "updateUserAssignments_notFound", e);
        return { success: false, error };
    }
    const { error } = createErrorReturn(`Failed to update user assignments.`, "updateUserAssignments", e);
    return { success: false, error };
  }
}
