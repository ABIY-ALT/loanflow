
'use server';

import { cookies } from 'next/headers';
import type { User } from '@/types/loan';
import type { Department as DepartmentType } from '@/types/loan';
import type { AppPermission } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import type { User as PrismaUser, Department as PrismaDepartment, Role as PrismaRole } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const secretKey = process.env.SESSION_SECRET;
const key = new TextEncoder().encode(secretKey);

async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h') // Token expires in 1 hour
    .sign(key);
}

async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // This will handle expired tokens or invalid tokens
    console.error('JWT verification failed:', error);
    return null;
  }
}

function mapPrismaUserToAppUser(
  prismaUser: PrismaUser & {
    department?: PrismaDepartment | null;
    customRole?: PrismaRole | null;
  }
): User {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    firstName: prismaUser.firstName || undefined,
    lastName: prismaUser.lastName || undefined,
    fullName: prismaUser.name || `${prismaUser.firstName || ''} ${prismaUser.lastName || ''}`.trim() || prismaUser.email,
    phoneNumber: prismaUser.phoneNumber || undefined,
    departmentId: prismaUser.departmentId || undefined,
    department: prismaUser.department?.name as DepartmentType | undefined,
    customRoleId: prismaUser.customRoleId || undefined,
    customRoleName: prismaUser.customRole?.name || undefined,
    permissions: (prismaUser.customRole?.permissions as AppPermission[]) || [],
  };
}

export async function loginUser(phoneNumberInput: string, passwordInput: string): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!secretKey) {
    return { success: false, error: 'Session secret is not configured.' };
  }
  
  if (!phoneNumberInput || !passwordInput) {
    return { success: false, error: "Phone number and password are required." };
  }

  try {
    const user = await prisma.user.findFirst({
      where: { phoneNumber: phoneNumberInput },
      include: {
        department: true,
        customRole: true,
      },
    });

    if (!user) {
      return { success: false, error: "Invalid phone number or password." };
    }

    if (!user.passwordHash) {
       return { success: false, error: "Account not configured for password login." };
    }

    const passwordMatch = await bcrypt.compare(passwordInput, user.passwordHash);

    if (!passwordMatch) {
      return { success: false, error: "Invalid phone number or password." };
    }

    const appUser = mapPrismaUserToAppUser(user);

    // Create session
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const session = await encrypt({ userId: user.id, expires });

    cookies().set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    return { success: true, user: appUser };

  } catch (error: any) {
    console.error("Error during login:", error);
    return { success: false, error: 'An unexpected error occurred during login.' };
  }
}

export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    cookies().delete('session');
    return { success: true };
  } catch (error: any) {
     return { success: false, error: `An unexpected error occurred during logout: ${error.message}` };
  }
}

export async function getCurrentUser(): Promise<{ user: User | null }> {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return { user: null };

  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    // Invalid or expired session
    cookies().delete('session');
    return { user: null };
  }

  try {
    const prismaUser = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        department: true,
        customRole: true,
      },
    });

    if (!prismaUser) {
      return { user: null };
    }

    const appUser = mapPrismaUserToAppUser(prismaUser);
    return { user: appUser };
  } catch (error) {
     console.error("Error fetching user by session ID:", error);
     return { user: null };
  }
}

// The refreshAccessToken function is no longer needed with this JWT session model.
// The session cookie is valid for its entire duration.
// If it expires, the user simply has to log in again.
// We can remove it or leave it as a no-op.
export async function refreshAccessToken(): Promise<{ success: boolean; newAccessToken?: string; error?: string }> {
    // This function is no longer applicable in the new authentication system.
    // It can be removed or kept as a placeholder.
    return { success: false, error: "Token refresh is not used in this authentication system." };
}
