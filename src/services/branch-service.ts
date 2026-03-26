
'use server';

import prisma from '@/lib/prisma';
import type { Branch, District } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { getCurrentUser } from '@/app/auth/actions';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  console.error(`[BranchService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message };
};

/**
 * INTERNAL SERVICE LOGIC
 */

async function getDistrictsInternal(user: any) {
  if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) throw new Error("Unauthorized");
  return prisma.district.findMany({ orderBy: { name: 'asc' } });
}

async function getBranchesInternal(user: any) {
  const canView = user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES) || user?.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST);
  if (!canView) throw new Error("Unauthorized");
  const branches = await prisma.branch.findMany({
    include: { district: true },
    orderBy: [{ district: { name: 'asc' } }, { name: 'asc' }],
  });
  return branches.map(b => ({ id: b.id, name: b.name, districtId: b.districtId, districtName: b.district.name }));
}

/**
 * ACTIONS (ENTRY POINTS)
 */

export async function getDistricts() {
  const { user } = await getCurrentUser();
  try {
    const districts = await getDistrictsInternal(user);
    return { districts };
  } catch (e: any) {
    return createErrorResult(e.message, "getDistricts");
  }
}

export async function getBranches() {
  const { user } = await getCurrentUser();
  try {
    const branches = await getBranchesInternal(user);
    return { branches };
  } catch (e: any) {
    return createErrorResult(e.message, "getBranches");
  }
}

export async function addDistrict(name: string) {
  const { user } = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
  try {
    const newDistrict = await prisma.district.create({ data: { name: name.trim() } });
    return { id: newDistrict.id };
  } catch (e: any) {
    return createErrorResult("Failed to add district.", "addDistrict", e);
  }
}

export async function addBranch(name: string, districtId: string) {
  const { user } = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
  try {
    const newBranch = await prisma.branch.create({ data: { name: name.trim(), districtId } });
    return { id: newBranch.id };
  } catch (e: any) {
    return createErrorResult("Failed to add branch.", "addBranch", e);
  }
}

export async function updateDistrict(id: string, name: string) {
    const { user } = await getCurrentUser();
    if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
    try {
        await prisma.district.update({ where: { id }, data: { name: name.trim() } });
        return { success: true };
    } catch (e: any) {
        return createErrorResult("Failed to update district.", "updateDistrict", e);
    }
}

export async function updateBranch(id: string, name: string) {
    const { user } = await getCurrentUser();
    if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
    try {
        await prisma.branch.update({ where: { id }, data: { name: name.trim() } });
        return { success: true };
    } catch (e: any) {
        return createErrorResult("Failed to update branch.", "updateBranch", e);
    }
}

export async function deleteDistrict(id: string) {
  const { user } = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
  try {
    await prisma.district.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete district.`, "deleteDistrict", e);
  }
}

export async function deleteBranch(id: string) {
  const { user } = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_BRANCHES)) return { error: "Unauthorized" };
  try {
    await prisma.branch.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete branch.`, "deleteBranch", e);
  }
}
