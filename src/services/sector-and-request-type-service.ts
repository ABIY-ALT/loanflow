'use server';

import prisma from '@/lib/prisma';
import type { Sector as PrismaSector, RequestType as PrismaRequestType } from '@prisma/client';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions';
import type { Sector } from '@/types/loan';

export interface ConfigurableListItem {
  id: string;
  name: string;
}

const mapPrismaToApp = (prismaItem: PrismaSector): Sector => ({
  id: prismaItem.id,
  name: prismaItem.name,
  parentId: prismaItem.parentId,
});

interface ServiceResult<T> {
  data?: T;
  error?: string;
}

const createErrorResult = <T>(message: string, context?: string, originalError?: any): ServiceResult<T> => {
  console.error(`[ConfigService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message };
};

const hasPermission = async (isForCreatingLoan: boolean = false): Promise<boolean> => {
    const { user } = await getCurrentUser();
    if (!user) return false;
    
    if (isForCreatingLoan) {
      return user.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST);
    }
    
    return user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS);
}

// --- Sector Functions ---

export async function getSectors(): Promise<{ sectors?: Sector[]; error?: string }> {
  // Allow any authenticated user to view sectors for filtering and navigation
  const { user } = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  
  try {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
    return { sectors: sectors.map(mapPrismaToApp) };
  } catch (e: any) {
    const result = createErrorResult<Sector[]>("Failed to fetch sectors.", "getSectors", e);
    return { error: result.error };
  }
}

export async function addSector(name: string, parentId: string | null): Promise<{ id?: string; error?: string }> {
  if (!await hasPermission()) return { error: "Unauthorized" };
  if (!name.trim()) return { error: "Sector name cannot be empty." };
  try {
    const existing = await prisma.sector.findUnique({ where: { name: name.trim() } });
    if (existing) return { error: `Sector with name "${name.trim()}" already exists.` };

    const newSector = await prisma.sector.create({ 
        data: { 
            name: name.trim(),
            parentId: parentId || undefined,
        } 
    });
    return { id: newSector.id };
  } catch (e: any) {
    if ((e as any).code === 'P2003' && (e as any).meta?.field_name?.includes('parentId')) {
        return { error: "Invalid Parent Sector selected." };
    }
    const result = createErrorResult<string>("Failed to add sector.", "addSector", e);
    return { error: result.error };
  }
}

export async function updateSector(id: string, name: string): Promise<ServiceResult<Sector>> {
    if (!await hasPermission()) return { error: "Unauthorized" };
    if (!name.trim()) return { error: "Sector name cannot be empty." };
    try {
        const existing = await prisma.sector.findFirst({ where: { name: name.trim(), id: { not: id } } });
        if (existing) return { error: `Another sector with name "${name.trim()}" already exists.` };

        const updatedSector = await prisma.sector.update({ where: { id }, data: { name: name.trim(), updatedAt: new Date() } });
        return { data: mapPrismaToApp(updatedSector) };
    } catch (e: any) {
        if ((e as any).code === 'P2025') return createErrorResult<Sector>(`Sector not found.`, "updateSector", e);
        return createErrorResult<Sector>(`Failed to update sector.`, "updateSector", e);
    }
}

export async function deleteSector(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return { error: "Unauthorized" };
  try {
    const childrenCount = await prisma.sector.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return { error: `Cannot delete: Sector has ${childrenCount} child sector(s).` };
    }
    
    const relatedWorkflows = await prisma.workflowDefinition.count({ where: { sectorId: id } });
    if (relatedWorkflows > 0) {
      return { error: `Cannot delete: Sector is linked to ${relatedWorkflows} workflow definition(s).` };
    }

    await prisma.sector.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true };
    const result = createErrorResult<boolean>(`Failed to delete sector.`, "deleteSector", e);
    return { error: result.error };
  }
}

// --- RequestType Functions ---

export async function getRequestTypes(): Promise<{ requestTypes?: ConfigurableListItem[]; error?: string }> {
  const { user } = await getCurrentUser();
  if(!user) return { error: "Unauthorized" };

  try {
    const requestTypes = await prisma.requestType.findMany({ orderBy: { name: 'asc' } });
    return { requestTypes };
  } catch (e: any) {
    const result = createErrorResult<ConfigurableListItem[]>("Failed to fetch request types.", "getRequestTypes", e);
    return { error: result.error };
  }
}

export async function addRequestType(name: string): Promise<{ id?: string; error?: string }> {
  if (!await hasPermission()) return { error: "Unauthorized" };
  if (!name.trim()) return { error: "Request type name cannot be empty." };
  try {
    const existing = await prisma.requestType.findUnique({ where: { name: name.trim() } });
    if (existing) return { error: `Request type with name "${name.trim()}" already exists.` };

    const newRequestType = await prisma.requestType.create({ data: { name: name.trim() } });
    return { id: newRequestType.id };
  } catch (e: any) {
    const result = createErrorResult<string>("Failed to add request type.", "addRequestType", e);
    return { error: result.error };
  }
}

export async function updateRequestType(id: string, name: string): Promise<ServiceResult<ConfigurableListItem>> {
    if (!await hasPermission()) return { error: "Unauthorized" };
    if (!name.trim()) return { error: "Request type name cannot be empty." };
    try {
        const existing = await prisma.requestType.findFirst({ where: { name: name.trim(), id: { not: id } } });
        if (existing) return { error: `Another request type with name "${name.trim()}" already exists.` };

        const updatedRequestType = await prisma.requestType.update({ where: { id }, data: { name: name.trim(), updatedAt: new Date() } });
        return { data: { id: updatedRequestType.id, name: updatedRequestType.name } };
    } catch (e: any) {
        if ((e as any).code === 'P2025') return createErrorResult<ConfigurableListItem>(`Request type not found.`, "updateRequestType", e);
        return createErrorResult<ConfigurableListItem>(`Failed to update request type.`, "updateRequestType", e);
    }
}

export async function deleteRequestType(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!await hasPermission()) return { error: "Unauthorized" };
  try {
    const relatedLoans = await prisma.loanRequest.count({ where: { requestTypeId: id } });
    if (relatedLoans > 0) {
      return { error: `Cannot delete: Request Type is linked to ${relatedLoans} existing loan(s).` };
    }
    await prisma.requestType.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2025') return { success: true };
    const result = createErrorResult<boolean>(`Failed to delete request type.`, "deleteRequestType", e);
    return { error: result.error };
  }
}
