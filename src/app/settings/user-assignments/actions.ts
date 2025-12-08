
'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions'; 
import bcrypt from 'bcryptjs';

export interface UserForAssignment {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  departmentId: string | null;
  departmentName: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
  isActive: boolean;
}

export interface AssignableData {
  departments: { id: string; name: string }[];
  customRoles: { id: string; name: string }[];
}

export interface UserAssignmentUpdatePayload {
  departmentId?: string | null;
  customRoleId?: string | null;
}

const createErrorReturn = (message: string, context?: string, originalError?: any): { success: boolean; message: string; statusCode: number } => {
  const genericMessage = 'An unexpected server error occurred. Please try again later.';
  console.error(`[UserAssignmentsActions:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { success: false, message: genericMessage, statusCode: 500 };
};

const createClientErrorReturn = (message: string, statusCode = 400): { success: boolean; message: string; statusCode: number } => {
    return { success: false, message: message, statusCode: statusCode };
}

function generateTemporaryPassword(length = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest of the password length
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to avoid predictable start
    return password.split('').sort(() => 0.5 - Math.random()).join('');
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
      phoneNumber: u.phoneNumber,
      departmentId: u.departmentId,
      departmentName: u.department?.name || null,
      customRoleId: u.customRoleId,
      customRoleName: u.customRole?.name || null,
      isActive: u.isActive,
    }));

    return { users: mappedUsers };
  } catch (e: any) {
    const { message } = createErrorReturn("Failed to fetch users.", "getUsersForAssignment", e);
    return { error: message };
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
    const { message } = createErrorReturn("Failed to fetch assignable data.", "getAssignableData", e);
    return { error: message };
  }
}

export async function updateUserAssignments(
  userId: string,
  data: UserAssignmentUpdatePayload
): Promise<{ success: boolean; error?: string; user?: UserForAssignment }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { success: false, error: "Unauthorized: You do not have permission to update users." };
    }

    if (!userId) {
      return { success: false, error: "User ID is required." };
    }

    const updateData: any = {};

    if (data.hasOwnProperty('departmentId')) {
      if (data.departmentId === null || data.departmentId === "none") {
        updateData.departmentId = null;
      } else if (data.departmentId) {
        const deptExists = await prisma.department.findUnique({ where: { id: data.departmentId } });
        if (!deptExists) return { success: false, error: "Department not found." };
        updateData.departmentId = data.departmentId;
      }
    }

    if (data.hasOwnProperty('customRoleId')) {
      if (data.customRoleId === null || data.customRoleId === "none") {
        updateData.customRoleId = null;
      } else if (data.customRoleId) {
        const roleExists = await prisma.role.findUnique({ where: { id: data.customRoleId } });
        if (!roleExists) return { success: false, error: "Custom role not found." };
        updateData.customRoleId = data.customRoleId;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
        return { success: false, error: "No changes provided for update." };
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
      phoneNumber: updatedUserPrisma.phoneNumber,
      departmentId: updatedUserPrisma.departmentId,
      departmentName: updatedUserPrisma.department?.name || null,
      customRoleId: updatedUserPrisma.customRoleId,
      customRoleName: updatedUserPrisma.customRole?.name || null,
      isActive: updatedUserPrisma.isActive,
    };

    return { success: true, user: mappedUser };
  } catch (e: any) {
    if (e.code === 'P2025') {
        const { message } = createErrorReturn(`User not found.`, "updateUserAssignments_notFound", e);
        return { success: false, error: message };
    }
    const { message } = createErrorReturn(`Failed to update user assignments.`, "updateUserAssignments", e);
    return { success: false, error: message };
  }
}

export async function resetUserPasswordAction(userId: string): Promise<{ success: boolean; message: string; newPassword?: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { success: false, message: 'Unauthorized: You do not have permission to reset passwords.' };
    }
    
    const userToReset = await prisma.user.findUnique({ where: { id: userId }});
    if (!userToReset) {
      return { success: false, message: 'User not found.' };
    }

    const newPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        isPasswordChanged: false, // Force user to change it on next login
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    return { success: true, message: `Password for ${userToReset.name} has been reset.`, newPassword: newPassword };
  } catch (e: any) {
    const { message } = createErrorReturn('Failed to reset password.', 'resetUserPasswordAction', e);
    return { success: false, message };
  }
}

export async function toggleUserStatusAction(userId: string, newStatus: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const { user: adminUser } = await getCurrentUser();
    if (!adminUser || !adminUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return { success: false, message: 'Unauthorized: You do not have permission to change user status.' };
    }
    
    if (adminUser.id === userId) {
        return { success: false, message: 'You cannot change your own active status.' };
    }
    
    const userToUpdate = await prisma.user.findUnique({ where: { id: userId }});
    if (!userToUpdate) {
        return { success: false, message: 'User not found.' };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
    });

    const statusText = newStatus ? 'activated' : 'deactivated';
    return { success: true, message: `User ${userToUpdate.name} has been ${statusText}.` };
  } catch (e: any) {
    const { message } = createErrorReturn(`Failed to toggle user status.`, 'toggleUserStatusAction', e);
    return { success: false, message };
  }
}
