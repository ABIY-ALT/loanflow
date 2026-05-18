'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  console.error(`[CRMService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message };
};

export async function getCRMMappings(userId?: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getCRMMappings");

    const where: any = {};
    if (userId) {
      where.userId = userId;
    } else if (!user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      // If not admin, only see own mappings
      where.userId = user.id;
    }

    const mappings = await prisma.branchCRMMapping.findMany({
      where,
      include: {
        branch: {
          include: {
            district: true
          }
        },
        user: true
      }
    });

    return { mappings };
  } catch (e: any) {
    return createErrorResult(e.message, "getCRMMappings");
  }
}

export async function addCRMMapping(branchId: string, userId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user?.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return createErrorResult("Unauthorized", "addCRMMapping");
    }

    const mapping = await prisma.branchCRMMapping.create({
      data: {
        branchId,
        userId
      }
    });

    return { mapping };
  } catch (e: any) {
    return createErrorResult(e.message, "addCRMMapping");
  }
}

export async function deleteCRMMapping(id: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user?.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      return createErrorResult("Unauthorized", "deleteCRMMapping");
    }

    await prisma.branchCRMMapping.delete({
      where: { id }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "deleteCRMMapping");
  }
}

export async function getCRMBranches() {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getCRMBranches");

    // Simplified: Return all branches for all users (CRM, Loan Officer, etc.)
    const allBranches = await prisma.branch.findMany({
      include: {
        district: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return { 
      branches: allBranches.map(b => ({
        id: b.id,
        name: b.name,
        districtId: b.districtId,
        districtName: b.district.name
      })) 
    };
  } catch (e: any) {
    return createErrorResult(e.message, "getCRMBranches");
  }
}
