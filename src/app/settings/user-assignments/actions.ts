
'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions'; // Import PERMISSIONS

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

// Helper to create consistent error responses
const createErrorReturn = (message: string, statusCode = 500) => {
  console.error(`[UserAssignmentsActions] Error: ${message}`);
  return { success: false, error: message, statusCode };
};

export async function getUsersForAssignment(): Promise<{ users?: UserForAssignment[]; error?: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { error: "Unauthorized: Admin access required (MANAGE_USERS permission)." };
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
    return { error: `Failed to fetch users: ${e.message}` };
  }
}

export async function getAssignableData(): Promise<{ data?: AssignableData; error?: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { error: "Unauthorized: Admin access required (MANAGE_USERS permission)." };
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
    return { error: `Failed to fetch assignable data: ${e.message}` };
  }
}

export async function updateUserAssignments(
  userId: string,
  data: UserAssignmentUpdatePayload
): Promise<{ success: boolean; error?: string; user?: UserForAssignment }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return createErrorReturn("Unauthorized: Admin access required (MANAGE_USERS permission).", 403);
    }

    if (!userId) {
      return createErrorReturn("User ID is required.", 400);
    }

    const updateData: any = {};

    if (data.hasOwnProperty('departmentId')) {
      if (data.departmentId === null || data.departmentId === "none") {
        updateData.departmentId = null;
      } else if (data.departmentId) {
        const deptExists = await prisma.department.findUnique({ where: { id: data.departmentId } });
        if (!deptExists) return createErrorReturn(`Department with ID ${data.departmentId} not found.`, 400);
        updateData.departmentId = data.departmentId;
      }
    }

    if (data.hasOwnProperty('customRoleId')) {
      if (data.customRoleId === null || data.customRoleId === "none") {
        updateData.customRoleId = null;
      } else if (data.customRoleId) {
        const roleExists = await prisma.role.findUnique({ where: { id: data.customRoleId } });
        if (!roleExists) return createErrorReturn(`Custom role with ID ${data.customRoleId} not found.`, 400);
        updateData.customRoleId = data.customRoleId;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
        return createErrorReturn("No changes provided for update.", 400);
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
    if (e.code === 'P2025') { // Prisma error code for record not found
        return createErrorReturn(`User with ID ${userId} not found for update.`, 404);
    }
    return createErrorReturn(`Failed to update user assignments: ${e.message}`, 500);
  }
}

