

'use server';

import prisma from '@/lib/prisma';
import type { Role as PrismaRole } from '@prisma/client';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions'; 
import { getCurrentUser } from '@/app/auth/actions';

export interface AppRole {
  id: string;
  name: string;
  description?: string | null;
  permissions: AppPermission[];
  createdAt: string;
  updatedAt: string;
}

const mapPrismaRoleToAppRole = (prismaRole: PrismaRole): AppRole => ({
  id: prismaRole.id,
  name: prismaRole.name,
  description: prismaRole.description,
  permissions: prismaRole.permissions as AppPermission[],
  createdAt: prismaRole.createdAt.toISOString(),
  updatedAt: prismaRole.updatedAt.toISOString(),
});

interface RoleServiceResult<T> {
  data?: T;
  error?: string;
}

const createErrorResult = <T>(message: string, context?: string, originalError?: any): RoleServiceResult<T> => {
  const genericMessage = 'An unexpected error occurred in the role service.';
  console.error(`[RoleService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: genericMessage };
};

const hasPermission = async (): Promise<boolean> => {
    const { user } = await getCurrentUser();
    return !!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_ROLES);
}

export async function getRoles(): Promise<RoleServiceResult<AppRole[]>> {
  if (!await hasPermission()) return { error: "Unauthorized access." };
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: roles.map(mapPrismaRoleToAppRole) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch roles.", "getRoles", e);
  }
}

export async function addRole(
  name: string,
  description?: string,
  permissions?: AppPermission[]
): Promise<RoleServiceResult<AppRole>> {
  if (!await hasPermission()) return { error: "Unauthorized access." };
  if (!name.trim()) {
    return { error: "Role name cannot be empty." };
  }
  try {
    const existingRole = await prisma.role.findUnique({
      where: { name: name.trim() },
    });
    if (existingRole) {
      return { error: `Role with name "${name.trim()}" already exists.` };
    }

    const newRole = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissions || [],
      },
    });
    return { data: mapPrismaRoleToAppRole(newRole) };
  } catch (e: any) {
    return createErrorResult("Failed to add role.", "addRole", e);
  }
}

export async function updateRole(
  id: string,
  name: string,
  description?: string | null,
  permissions?: AppPermission[]
): Promise<RoleServiceResult<AppRole>> {
  if (!await hasPermission()) return { error: "Unauthorized access." };
  if (!name.trim()) {
    return { error: "Role name cannot be empty." };
  }
  try {
    const existingRoleWithNewName = await prisma.role.findFirst({
      where: {
        name: name.trim(),
        id: { not: id },
      },
    });
    if (existingRoleWithNewName) {
      return { error: `Another role with name "${name.trim()}" already exists.` };
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description === undefined ? undefined : (description?.trim() || null),
        permissions: permissions || [],
        updatedAt: new Date(),
      },
    });
    return { data: mapPrismaRoleToAppRole(updatedRole) };
  } catch (e: any) {
    if ((e as any).code === 'P2025') {
        return createErrorResult(`Role not found.`, "updateRole", e);
    }
    return createErrorResult(`Failed to update role.`, "updateRole", e);
  }
}


export async function deleteRole(id: string): Promise<RoleServiceResult<boolean>> {
  if (!await hasPermission()) return { error: "Unauthorized access." };
  try {
    const usersWithRole = await prisma.user.count({ where: { customRoleId: id } });
    if (usersWithRole > 0) {
      return { error: `Cannot delete: Role is assigned to ${usersWithRole} user(s).` };
    }

    await prisma.role.delete({
      where: { id },
    });
    return { data: true };
  } catch (e: any)
   {
    if ((e as any).code === 'P2025') {
        return { data: true }; 
    }
    return createErrorResult(`Failed to delete role.`, "deleteRole", e);
  }
}
