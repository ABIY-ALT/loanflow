
'use server';

import prisma from '@/lib/prisma';
import type { Role as PrismaRole } from '@prisma/client';
import type { AppPermission } from '@/lib/permissions'; // Import AppPermission

export interface AppRole {
  id: string;
  name: string;
  description?: string | null;
  permissions: AppPermission[]; // Changed from string[] to AppPermission[]
  createdAt: string;
  updatedAt: string;
}

const mapPrismaRoleToAppRole = (prismaRole: PrismaRole): AppRole => ({
  id: prismaRole.id,
  name: prismaRole.name,
  description: prismaRole.description,
  permissions: prismaRole.permissions as AppPermission[], // Cast to AppPermission[]
  createdAt: prismaRole.createdAt.toISOString(),
  updatedAt: prismaRole.updatedAt.toISOString(),
});

interface RoleServiceResult<T> {
  data?: T;
  error?: string;
}

export async function getRoles(): Promise<RoleServiceResult<AppRole[]>> {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: roles.map(mapPrismaRoleToAppRole) };
  } catch (e: any) {
    console.error("Error fetching roles:", e);
    return { error: e.message || "Failed to fetch roles." };
  }
}

export async function addRole(
  name: string,
  description?: string,
  permissions?: AppPermission[] // Changed from string[]
): Promise<RoleServiceResult<AppRole>> {
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
        permissions: permissions || [], // Store permissions
      },
    });
    return { data: mapPrismaRoleToAppRole(newRole) };
  } catch (e: any) {
    console.error("Error adding role:", e);
    return { error: e.message || "Failed to add role." };
  }
}

export async function updateRole(
  id: string,
  name: string,
  description?: string | null,
  permissions?: AppPermission[]
): Promise<RoleServiceResult<AppRole>> {
  if (!name.trim()) {
    return { error: "Role name cannot be empty." };
  }
  try {
    // Check if another role with the new name already exists (if name is being changed)
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
        description: description === undefined ? undefined : (description?.trim() || null), // Handle undefined vs null/empty
        permissions: permissions || [],
        updatedAt: new Date(),
      },
    });
    return { data: mapPrismaRoleToAppRole(updatedRole) };
  } catch (e: any) {
    console.error(`Error updating role ${id}:`, e);
    if ((e as any).code === 'P2025') {
        return { error: `Role with ID "${id}" not found for update.`};
    }
    return { error: e.message || `Failed to update role ${id}.` };
  }
}


export async function deleteRole(id: string): Promise<RoleServiceResult<boolean>> {
  try {
    // Check if any users are assigned to this role
    const usersWithRole = await prisma.user.count({ where: { customRoleId: id } });
    if (usersWithRole > 0) {
      return { error: `Cannot delete role. It is currently assigned to ${usersWithRole} user(s). Please reassign users before deleting.` };
    }

    await prisma.role.delete({
      where: { id },
    });
    return { data: true };
  } catch (e: any)
   {
    console.error("Error deleting role:", e);
    if ((e as any).code === 'P2025') {
        return { data: true }; 
    }
    return { error: e.message || `Failed to delete role with ID ${id}.` };
  }
}
