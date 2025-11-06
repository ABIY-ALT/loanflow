
'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import bcrypt from 'bcryptjs';

const passwordSchema = new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$');

export async function changePasswordAction(
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  const { user } = await getCurrentUser();

  if (!user) {
    return { success: false, message: 'Authentication error. Please log in again.' };
  }

  const oldPassword = formData.get('oldPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!oldPassword || !newPassword) {
    return { success: false, message: 'Old and new passwords are required.' };
  }
   if (!passwordSchema.test(newPassword)) {
    return { success: false, message: 'New password does not meet the security requirements. It must be at least 8 characters and include uppercase, lowercase, number, and special characters.' };
  }

  try {
    const prismaUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!prismaUser || !prismaUser.passwordHash) {
      return { success: false, message: 'User not found or not configured for password login.' };
    }

    const passwordMatch = await bcrypt.compare(oldPassword, prismaUser.passwordHash);

    if (!passwordMatch) {
      return { success: false, message: 'The old password you entered is incorrect.' };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        isPasswordChanged: true,
      },
    });

    return { success: true, message: 'Password changed successfully.' };

  } catch (error: any) {
    console.error('Error changing password:', error);
    return { success: false, message: 'An unexpected error occurred while changing the password.' };
  }
}
