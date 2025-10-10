

'use server';

import prisma from '@/lib/prisma';
import type { LoanType as PrismaLoanType } from '@prisma/client';

export interface LoanType {
  id: string;
  name: string;
}

const mapPrismaLoanTypeToApp = (prismaLoanType: PrismaLoanType): LoanType => ({
  id: prismaLoanType.id,
  name: prismaLoanType.name,
});

interface LoanTypeServiceResult<T> {
  data?: T;
  error?: string;
}

export async function getLoanTypes(): Promise<{ loanTypes?: LoanType[]; error?: string }> {
  try {
    const loanTypes = await prisma.loanType.findMany({
      orderBy: { name: 'asc' },
    });
    return { loanTypes: loanTypes.map(mapPrismaLoanTypeToApp) };
  } catch (e: any) {
    console.error("Error fetching loan types:", e);
    return { error: e.message || "Failed to fetch loan types." };
  }
}

export async function addLoanType(name: string): Promise<{ id?: string; error?: string }> {
  if (!name.trim()) {
    return { error: "Loan type name cannot be empty." };
  }
  try {
    const existing = await prisma.loanType.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return { error: `Loan type with name "${name.trim()}" already exists.` };
    }

    const newLoanType = await prisma.loanType.create({
      data: {
        name: name.trim(),
      },
    });
    return { id: newLoanType.id };
  } catch (e: any) {
    console.error("Error adding loan type:", e);
    return { error: e.message || "Failed to add loan type." };
  }
}

export async function deleteLoanType(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const relatedWorkflows = await prisma.workflowDefinition.count({ where: { loanTypeId: id } });
    if (relatedWorkflows > 0) {
      return { error: `Cannot delete loan type. It is linked to ${relatedWorkflows} workflow definition(s).` };
    }

    await prisma.loanType.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    console.error(`Error deleting loan type ${id}:`, e);
    if ((e as any).code === 'P2025') {
      return { success: true }; // Already deleted
    }
    return { error: e.message || `Failed to delete loan type ${id}.` };
  }
}
