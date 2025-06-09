
'use server';

import prisma from '@/lib/prisma';
import type { Role as PrismaRole } from '@prisma/client';

export interface AppRole {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

const mapPrismaRoleToAppRole = (prismaRole: PrismaRole): AppRole => ({
  id: prismaRole.id,
  name: prismaRole.name,
  description: prismaRole.description,
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
  description?: string
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
      },
    });
    return { data: mapPrismaRoleToAppRole(newRole) };
  } catch (e: any) {
    console.error("Error adding role:", e);
    return { error: e.message || "Failed to add role." };
  }
}

export async function deleteRole(id: string): Promise<RoleServiceResult<boolean>> {
  try {
    // In a real app, you'd check if this role is currently assigned to any users
    // or permissions before allowing deletion.
    // For now, we'll just delete it.
    // Example check:
    // const usersWithRole = await prisma.user.count({ where: { customRoleId: id } });
    // if (usersWithRole > 0) {
    //   return { error: `Cannot delete role. It is currently assigned to ${usersWithRole} user(s).` };
    // }

    await prisma.role.delete({
      where: { id },
    });
    return { data: true };
  } catch (e: any)
   {
    console.error("Error deleting role:", e);
    // Prisma error P2025 means record to delete not found, which is fine for a delete op if it's already gone.
    // Other errors like P2003 (foreign key constraint violation) would be more critical if roles were linked.
    if ((e as any).code === 'P2025') {
        return { data: true }; // Effectively deleted or already gone
    }
    return { error: e.message || `Failed to delete role with ID ${id}.` };
  }
}
