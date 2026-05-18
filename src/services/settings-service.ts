
'use server';

import prisma from '@/lib/prisma';

export async function getSystemSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key }
    });
    return setting?.value || defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
}

export async function updateSystemSetting(key: string, value: string) {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating setting ${key}:`, error);
    return { error: error.message };
  }
}

export async function getCommitteeSettings() {
    const size = await getSystemSetting('committee_size', '4');
    const threshold = await getSystemSetting('committee_threshold', '3');
    return {
        size: parseInt(size, 10),
        threshold: parseInt(threshold, 10)
    };
}

export async function updateCommitteeSettings(size: number, threshold: number) {
    const r1 = await updateSystemSetting('committee_size', size.toString());
    const r2 = await updateSystemSetting('committee_threshold', threshold.toString());
    
    if (r1.error || r2.error) return { error: r1.error || r2.error };
    return { success: true };
}
export async function getDistrictSettings() {
    const overdueHours = await getSystemSetting('district_overdue_hours', '24');
    return {
        overdueHours: parseInt(overdueHours, 10)
    };
}

export async function updateDistrictSettings(overdueHours: number) {
    return await updateSystemSetting('district_overdue_hours', overdueHours.toString());
}
