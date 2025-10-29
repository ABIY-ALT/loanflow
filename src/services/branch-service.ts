

'use server';

import prisma from '@/lib/prisma';
import type { Branch as PrismaBranch, District as PrismaDistrict } from '@prisma/client';
import type { Branch, District } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { getCurrentUser } from '@/app/auth/actions';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  console.error(`[BranchService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: `Branch Service Error: ${message}` };
};

const hasPermission = async (): Promise<boolean> => {
    const { user } = await getCurrentUser();
    return !!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES);
}

// --- District Functions ---

export async function getDistricts(): Promise<{ districts?: District[]; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "getDistricts");
  try {
    const districts = await prisma.district.findMany({ orderBy: { name: 'asc' } });
    return { districts };
  } catch (e: any) {
    return createErrorResult("Failed to fetch districts.", "getDistricts", e);
  }
}

export async function addDistrict(name: string): Promise<{ id?: string; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "addDistrict");
  if (!name.trim()) return createErrorResult("District name cannot be empty.", "addDistrict");
  try {
    const existing = await prisma.district.findUnique({ where: { name: name.trim() } });
    if (existing) return createErrorResult(`District "${name.trim()}" already exists.`, "addDistrict");
    
    const newDistrict = await prisma.district.create({ data: { name: name.trim() } });
    return { id: newDistrict.id };
  } catch (e: any) {
    return createErrorResult("Failed to add district.", "addDistrict", e);
  }
}

export async function deleteDistrict(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "deleteDistrict");
  try {
    // Prisma's cascading delete will handle deleting associated branches
    await prisma.district.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true }; // Already deleted
    return createErrorResult(`Failed to delete district. It might be in use or already deleted.`, "deleteDistrict", e);
  }
}


// --- Branch Functions ---

export async function getBranches(): Promise<{ branches?: Branch[]; error?: string }> {
   // No permission check here, as branches might be needed for forms by non-admins
  try {
    const branches = await prisma.branch.findMany({
      include: { district: true },
      orderBy: [{ district: { name: 'asc' } }, { name: 'asc' }],
    });
    const mappedBranches: Branch[] = branches.map(b => ({
      id: b.id,
      name: b.name,
      districtId: b.districtId,
      districtName: b.district.name,
    }));
    return { branches: mappedBranches };
  } catch (e: any) {
    return createErrorResult("Failed to fetch branches.", "getBranches", e);
  }
}

export async function addBranch(name: string, districtId: string): Promise<{ id?: string; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "addBranch");
  if (!name.trim()) return createErrorResult("Branch name cannot be empty.", "addBranch");
  if (!districtId) return createErrorResult("District must be selected.", "addBranch");

  try {
    const existing = await prisma.branch.findFirst({ where: { name: name.trim(), districtId } });
    if (existing) return createErrorResult(`Branch "${name.trim()}" already exists in this district.`, "addBranch");
    
    const newBranch = await prisma.branch.create({
      data: {
        name: name.trim(),
        district: { connect: { id: districtId } },
      },
    });
    return { id: newBranch.id };
  } catch (e: any) {
    if ((e as any).code === 'P2025') {
       return createErrorResult(`District with ID "${districtId}" not found.`, "addBranch", e);
    }
    return createErrorResult("Failed to add branch.", "addBranch", e);
  }
}

export async function deleteBranch(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "deleteBranch");
  try {
    await prisma.branch.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true }; // Already deleted
    return createErrorResult(`Failed to delete branch. It might be in use or already deleted.`, "deleteBranch", e);
  }
}
