
'use server';

import { cookies } from 'next/headers';
import type { User } from '@/types/loan'; // Updated User type
import type { Department as DepartmentType } from '@/types/loan';
import type { AppPermission } from '@/lib/permissions';
import { jwtDecode } from 'jwt-decode';
import prisma from '@/lib/prisma';
import type { User as PrismaUser, Department as PrismaDepartment, Role as PrismaRole } from '@prisma/client';
import { Console } from 'console';

interface MinimalJwtPayload {
  sub: string; // User ID from Identity Server
  email: string;
  // Other minimal claims like iat, exp, iss, aud
  firstName?: string; // If Identity Server still provides these
  lastName?: string;
  unique_name?: string; // If Identity Server still provides these
  ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone']?: string;
  exp?: number; // Added for explicit check
}

// Maps Prisma User (with relations) to our application User type
function mapPrismaUserToAppUser(
  prismaUser: PrismaUser & {
    department?: PrismaDepartment | null;
    customRole?: PrismaRole | null;
  }
): User {
  return {
    id: prismaUser.id, // Using Prisma's own User ID as the canonical ID now
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
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  if (!identityServiceUrl) {
    return { success: false, error: "Identity service URL is not configured." };
  }

  try {
    const response = await fetch(`${identityServiceUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumberInput, password: passwordInput }),
    });

    const identityData = await response.json();

    if (!response.ok || !identityData.isSuccess) {
      return { success: false, error: identityData.errors?.[0]?.description || identityData.errors || 'Login failed from identity service.' };
    }

    const { accessToken, refreshToken } = identityData;

    if (!accessToken || !refreshToken) {
      return { success: false, error: "Access token or refresh token missing in response." };
    }

    let decodedJwt: MinimalJwtPayload;
    try {
        decodedJwt = jwtDecode<MinimalJwtPayload>(accessToken);
    } catch (error) {
        console.error("Error decoding JWT from Identity Server:", error);
        return { success: false, error: "Failed to parse token from identity server."};
    }

    if (!decodedJwt.sub) {
        return { success: false, error: "User ID (sub) missing in token from identity server."};
    }
    
    // Fetch user from Prisma database using the ID from the token
    const prismaUser = await prisma.user.findUnique({
      where: { userId: decodedJwt.sub }, // Assuming JWT 'sub' maps to 'userId' in your Prisma User model
      include: {
        department: true,
        customRole: true, // This will include the permissions array from the Role model
      },
    });

    if (!prismaUser) {
      // This case should ideally be handled during registration: if a user exists in Identity Server
      // but not in local Prisma DB, there's a sync issue or incomplete registration.
      console.error(`User with Identity Server ID ${decodedJwt.sub} not found in local Prisma database.`);
      return { success: false, error: "User account not found in the application database. Please contact support." };
    }

    const appUser = mapPrismaUserToAppUser(prismaUser);

    const cookieStore = await cookies();
    cookieStore.set('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    cookieStore.set('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    
    return { success: true, user: appUser };

  } catch (error: any) {
    console.error("Network or unexpected error during login:", error);
    return { success: false, error: error.message || 'An unexpected error occurred during login.' };
  }
}

export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshTokenValue = cookieStore.get('refreshToken')?.value; // Renamed to avoid conflict

  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');

  if (!identityServiceUrl) {
    console.warn("Identity service URL not configured for server-side logout call. Local logout performed.");
    return { success: true };
  }

  if (!accessToken || !refreshTokenValue) {
    return { success: true }; // No tokens to revoke
  }

  try {
    await fetch(`${identityServiceUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken, refreshToken: refreshTokenValue }), // Use refreshTokenValue
    });
    // We don't strictly need to check the response, as we're logging out locally regardless.
  } catch (error: any) {
    console.error("Error calling identity service logout (non-critical):", error);
  }
  return { success: true };
}

export async function refreshAccessToken(): Promise<{ success: boolean; newAccessToken?: string; error?: string }> {
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  const cookieStore = await cookies();
  const currentAccessToken = cookieStore.get('accessToken')?.value;
  const currentRefreshToken = cookieStore.get('refreshToken')?.value;


  if (!identityServiceUrl || !currentAccessToken || !currentRefreshToken) {
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    return { success: false, error: "Missing configuration or tokens for refresh." };
  }

  try {
    const response = await fetch(`${identityServiceUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentAccessToken, refreshToken: currentRefreshToken }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response from identity server.");
      console.error(`Identity server refresh token failed. Status: ${response.status}. Response: ${errorText.substring(0,500)}`);
      cookieStore.delete('accessToken');
      cookieStore.delete('refreshToken');
      return { success: false, error: `Identity server failed to refresh token (Status: ${response.status}). Details: ${errorText.substring(0,100)}...` };
    }

    // If response.ok, then try to parse JSON
    const data = await response.json();
    
    if (!data.isSuccess) { // Assuming identity server returns { isSuccess: boolean }
      cookieStore.delete('accessToken');
      cookieStore.delete('refreshToken');
      return { success: false, error: data.errors?.[0]?.description || 'Identity server indicated refresh token failure.' };
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data;

    if (!newAccessToken || !newRefreshToken) {
        cookieStore.delete('accessToken');
        cookieStore.delete('refreshToken');
        return { success: false, error: 'Identity server did not return new tokens upon successful refresh.' };
    }

    cookieStore.set('accessToken', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    cookieStore.set('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return { success: true, newAccessToken };

  } catch (error: any) { // Catches network errors or if response.json() fails after being response.ok
    console.error("Error during refreshAccessToken fetch/processing:", error);
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken'); // Ensure logout on any failure here
    return { success: false, error: error.message || 'An unexpected error occurred during token refresh processing.' };
  }
}

export async function getCurrentUser(): Promise<{ user: User | null }> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return { user: null };
  }
  
  let decodedJwt: MinimalJwtPayload;
  try {
    decodedJwt = jwtDecode<MinimalJwtPayload>(accessToken);
    // Check for expiration
    if (decodedJwt.exp && Date.now() >= decodedJwt.exp * 1000) {
      console.log("Access token expired. Attempting refresh...");
      const refreshResult = await refreshAccessToken();
      if (refreshResult.success && refreshResult.newAccessToken) {
        accessToken = refreshResult.newAccessToken; // Use the new token
        decodedJwt = jwtDecode<MinimalJwtPayload>(accessToken); // Decode new token
      } else {
        console.log("Token refresh failed or new token not provided. Error:", refreshResult.error);
        // Cookies are deleted by refreshAccessToken on failure
        return { user: null };
      }
    }
  } catch (error) {
    console.error("Error decoding access token:", error);
    // Consider it an invalid token, try to refresh or clear
     const refreshResult = await refreshAccessToken();
      if (refreshResult.success && refreshResult.newAccessToken) {
        accessToken = refreshResult.newAccessToken;
        try {
            decodedJwt = jwtDecode<MinimalJwtPayload>(accessToken);
        } catch (nestedDecodeError) {
             console.error("Error decoding newly refreshed access token:", nestedDecodeError);
             return { user: null };
        }
      } else {
        console.log("Token refresh failed after decode error. Error:", refreshResult.error);
        return { user: null };
      }
  }

  if (!decodedJwt || !decodedJwt.sub) {
    console.warn("Decoded JWT or 'sub' claim is missing after potential refresh.");
    return { user: null };
  }

  // Fetch user from Prisma database using the ID from the token
  const prismaUser = await prisma.user.findUnique({
    where: { userId: decodedJwt.sub }, // Use 'userId' which stores the Identity Server's 'sub'
    include: {
      department: true,
      customRole: true, 
    },
  });

  if (!prismaUser) {
    console.warn(`User with Identity Server ID ${decodedJwt.sub} found in token but not in local Prisma DB. Logging out.`);
    // This indicates a desync. Forcing logout.
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    return { user: null };
  }

  const appUser = mapPrismaUserToAppUser(prismaUser);
  return { user: appUser };
}

