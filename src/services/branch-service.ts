

'use server';

import prisma from '@/lib/prisma';
import type { Branch as PrismaBranch, District as PrismaDistrict } from '@prisma/client';
import type { Branch, District } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { getCurrentUser } from '@/app/auth/actions';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  const genericMessage = 'An unexpected error occurred in the branch service. Please try again later.';
  console.error(`[BranchService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: genericMessage };
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
  if (!name.trim()) {
      return { error: "District name cannot be empty." };
  }
  try {
    const existing = await prisma.district.findUnique({ where: { name: name.trim() } });
    if (existing) {
        return { error: `District "${name.trim()}" already exists.` };
    }
    
    const newDistrict = await prisma.district.create({ data: { name: name.trim() } });
    return { id: newDistrict.id };
  } catch (e: any) {
    return createErrorResult("Failed to add district.", "addDistrict", e);
  }
}

export async function updateDistrict(id: string, name: string): Promise<{ success?: boolean; error?: string }> {
    if (!await hasPermission()) return createErrorResult("Unauthorized access.", "updateDistrict");
    if (!name.trim()) {
        return { error: "District name cannot be empty." };
    }
    try {
        const existing = await prisma.district.findFirst({ where: { name: name.trim(), id: { not: id } } });
        if (existing) {
            return { error: `Another district with name "${name.trim()}" already exists.` };
        }
        
        await prisma.district.update({ where: { id }, data: { name: name.trim() } });
        return { success: true };
    } catch (e: any) {
        if ((e as any).code === 'P2025') return createErrorResult(`District not found.`, "updateDistrict", e);
        return createErrorResult("Failed to update district.", "updateDistrict", e);
    }
}

export async function deleteDistrict(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "deleteDistrict");
  try {
    await prisma.district.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true }; // Already deleted
    return createErrorResult(`Failed to delete district.`, "deleteDistrict", e);
  }
}


// --- Branch Functions ---

export async function getBranches(): Promise<{ branches?: Branch[]; error?: string }> {
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
  if (!name.trim()) {
      return { error: "Branch name cannot be empty." };
  }
  if (!districtId) {
      return { error: "District must be selected." };
  }

  try {
    const existing = await prisma.branch.findFirst({ where: { name: name.trim(), districtId } });
    if (existing) {
        return { error: `Branch "${name.trim()}" already exists in this district.` };
    }
    
    const newBranch = await prisma.branch.create({
      data: {
        name: name.trim(),
        district: { connect: { id: districtId } },
      },
    });
    return { id: newBranch.id };
  } catch (e: any) {
    return createErrorResult("Failed to add branch.", "addBranch", e);
  }
}

export async function updateBranch(id: string, name: string): Promise<{ success?: boolean; error?: string }> {
    if (!await hasPermission()) return createErrorResult("Unauthorized access.", "updateBranch");
    if (!name.trim()) {
        return { error: "Branch name cannot be empty." };
    }
    try {
        const branchToUpdate = await prisma.branch.findUnique({ where: { id } });
        if (!branchToUpdate) return createErrorResult(`Branch not found.`, "updateBranch");

        const existing = await prisma.branch.findFirst({ where: { name: name.trim(), districtId: branchToUpdate.districtId, id: { not: id } } });
        if (existing) {
            return { error: `Another branch with name "${name.trim()}" already exists in this district.` };
        }
        
        await prisma.branch.update({ where: { id }, data: { name: name.trim() } });
        return { success: true };
    } catch (e: any) {
        if ((e as any).code === 'P2025') return createErrorResult(`Branch not found.`, "updateBranch", e);
        return createErrorResult("Failed to update branch.", "updateBranch", e);
    }
}


export async function deleteBranch(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return createErrorResult("Unauthorized access.", "deleteBranch");
  try {
    await prisma.branch.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true }; // Already deleted
    return createErrorResult(`Failed to delete branch.`, "deleteBranch", e);
  }
}
