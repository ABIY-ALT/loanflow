
'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser as getAdminPerformingAction } from '@/app/auth/actions';
import { z } from 'zod';
import { PERMISSIONS } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

const registerUserFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string()
    .length(10, 'Phone number must be exactly 10 digits.')
    .regex(/^(09|07)\d{8}$/, 'Phone number must start with 09 or 07.'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[@$!%*?&]/, 'Password must contain at least one special character'),
});


export async function registerUserAction(formData: FormData): Promise<{ success: boolean; message: string; errors?: any }> {
  const adminAuth = await getAdminPerformingAction();
  if (!adminAuth.user || !adminAuth.user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
    return { success: false, message: 'Unauthorized: You do not have permission to register users.' };
  }

  const validationResult = registerUserFormSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validationResult.success) {
    return { success: false, message: 'Validation failed', errors: validationResult.error.flatten().fieldErrors };
  }

  const userData = validationResult.data;

  try {
    const existingLocalUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userData.email },
          ...(userData.phoneNumber ? [{ phoneNumber: userData.phoneNumber }] : []),
        ],
      },
    });

    if (existingLocalUser) {
      const field = existingLocalUser.email === userData.email ? 'email' : 'phone number';
      return { success: false, message: `User with this ${field} already exists.` };
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const generatedUserId = `local-${Date.now()}`; // Create a local unique ID

    await prisma.user.create({
      data: {
        id: generatedUserId, // Use the generated local ID for Prisma's 'id' field
        userId: generatedUserId, // Use the same local ID for the 'userId' field
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: `${userData.firstName} ${userData.lastName}`,
        phoneNumber: userData.phoneNumber,
        passwordHash: passwordHash,
        isPasswordChanged: false, // Force password change on first login
        departmentId: null,
        customRoleId: null,
      },
    });

    return { success: true, message: 'User registered successfully!' };
  } catch (error: any) {
    console.error('Error creating user in local Prisma DB:', error);
    return { success: false, message: `Failed to create user: ${error.message}` };
  }
}
