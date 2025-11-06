

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

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  const genericMessage = 'An unexpected error occurred in the loan type service.';
  console.error(`[LoanTypeService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: genericMessage };
};

export async function getLoanTypes(): Promise<{ loanTypes?: LoanType[]; error?: string }> {
  try {
    const loanTypes = await prisma.loanType.findMany({
      orderBy: { name: 'asc' },
    });
    return { loanTypes: loanTypes.map(mapPrismaLoanTypeToApp) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loan types.", "getLoanTypes", e);
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
    return createErrorResult("Failed to add loan type.", "addLoanType", e);
  }
}

export async function updateLoanType(id: string, name: string): Promise<LoanTypeServiceResult<LoanType>> {
    if (!name.trim()) {
        return { error: "Loan type name cannot be empty." };
    }
    try {
        const existing = await prisma.loanType.findFirst({
            where: {
                name: name.trim(),
                id: { not: id },
            },
        });
        if (existing) {
            return { error: `Another loan type with name "${name.trim()}" already exists.` };
        }

        const updatedLoanType = await prisma.loanType.update({
            where: { id },
            data: { name: name.trim(), updatedAt: new Date() },
        });
        return { data: mapPrismaLoanTypeToApp(updatedLoanType) };
    } catch (e: any) {
        if ((e as any).code === 'P2025') {
            return createErrorResult(`Loan type not found.`, "updateLoanType", e);
        }
        return createErrorResult(`Failed to update loan type.`, "updateLoanType", e);
    }
}

export async function deleteLoanType(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const relatedWorkflows = await prisma.workflowDefinition.count({ where: { loanTypeId: id } });
    if (relatedWorkflows > 0) {
      return { error: `Cannot delete: Loan type is linked to ${relatedWorkflows} workflow definition(s).` };
    }

    await prisma.loanType.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') {
      return { success: true };
    }
    return createErrorResult(`Failed to delete loan type.`, "deleteLoanType", e);
  }
}
