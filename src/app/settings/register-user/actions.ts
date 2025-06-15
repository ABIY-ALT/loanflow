
'use server';

import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { jwtDecode } from 'jwt-decode';
import { refreshAccessToken, getCurrentUser as getAdminPerformingAction } from '@/app/auth/actions';
import { z } from 'zod';
import { PERMISSIONS } from '@/lib/permissions';

// Define a schema for the user data from the form
const registerUserFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required').optional().or(z.literal('')),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

interface MinimalIdentityServerToken {
  sub: string; // This is the ID from the Identity Server
  // other minimal claims if relevant
}

export async function registerUserAction(formData: FormData): Promise<{ success: boolean; message: string; errors?: any }> {
  // 1. Check if the admin performing this action has MANAGE_USERS permission
  const adminAuth = await getAdminPerformingAction();
  if (!adminAuth.user || !adminAuth.user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
    return { success: false, message: 'Unauthorized: You do not have permission to register users.' };
  }

  const validationResult = registerUserFormSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validationResult.success) {
    return { success: false, message: 'Validation failed', errors: validationResult.error.flatten().fieldErrors };
  }

  const userData = validationResult.data;

  // Check if user already exists in local Prisma DB by email
  const existingLocalUser = await prisma.user.findUnique({
    where: { email: userData.email },
  });
  if (existingLocalUser) {
    return { success: false, message: 'User with this email already exists in the local database.' };
  }
  
  const cookieStore = await cookies();
  let adminAccessToken = cookieStore.get('accessToken')?.value;

  if (!adminAccessToken) {
    return { success: false, message: 'Unauthorized: Admin session token missing.' };
  }

  const sendRegistrationRequestToIdentityServer = async (token: string) => {
    const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
    if (!identityServiceUrl) throw new Error("Identity service URL is not configured.");

    return await fetch(`${identityServiceUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        password: userData.password,
        // Do NOT send roles or other sensitive data here; Identity Server is for auth only.
      }),
    });
  };

  let identityServerResponse: Response;
  try {
    identityServerResponse = await sendRegistrationRequestToIdentityServer(adminAccessToken);

    if (identityServerResponse.status === 401) { // Token expired
      const refreshResult = await refreshAccessToken();
      if (refreshResult.success && refreshResult.newAccessToken) {
        adminAccessToken = refreshResult.newAccessToken; // Update cookie with new token
        identityServerResponse = await sendRegistrationRequestToIdentityServer(adminAccessToken); // Retry
      } else {
        return { success: false, message: 'Admin session expired. Please log in again.' };
      }
    }
  } catch (e: any) {
     return { success: false, message: `Error communicating with Identity Server: ${e.message}` };
  }
  
  let identityServerData;
  try {
    identityServerData = await identityServerResponse.json();
  } catch (jsonError) {
    return { success: false, message: `Registration failed: Invalid response from identity server (Status: ${identityServerResponse.status}).` };
  }

  if (!identityServerResponse.ok || !identityServerData.isSuccess) {
    const errorMessage = identityServerData.errors?.map((err:any) => err.description).join(', ') || identityServerData.message || `Identity server registration failed (Status: ${identityServerResponse.status}).`;
    return { success: false, message: `Registration failed: ${errorMessage}` };
  }

  // User successfully registered with Identity Server. Now create in local Prisma DB.
  try {
    // The Identity Server response should contain the new user's ID ('sub' claim in its token)
    // For this example, assuming identityServerData.accessToken contains the new user's token
    if (!identityServerData.accessToken) {
        return { success: false, message: 'Identity Server did not return an access token for the new user.' };
    }
    const newUserTokenDecoded = jwtDecode<MinimalIdentityServerToken>(identityServerData.accessToken);
    const identityServerUserId = newUserTokenDecoded.sub;

    if (!identityServerUserId) {
        return { success: false, message: 'Could not retrieve new user ID from Identity Server token.' };
    }

    // Check again for safety, though the initial check should catch most cases
    const existingLocalUserByIdentity = await prisma.user.findUnique({ where: { userId: identityServerUserId }});
    if (existingLocalUserByIdentity) {
        return { success: false, message: `User with Identity ID ${identityServerUserId} already exists locally. Possible sync issue.`};
    }

    await prisma.user.create({
      data: {
        userId: identityServerUserId, // Store the ID from the Identity Server
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: `${userData.firstName} ${userData.lastName}`,
        phoneNumber: userData.phoneNumber || null,
        // New users are created without a department or custom role by default.
        // These are assigned later by an admin.
        departmentId: null,
        customRoleId: null,
      },
    });

    return { success: true, message: 'User registered successfully with Identity Server and created in local database!' };
  } catch (error: any) {
    console.error('Error creating user in local Prisma DB:', error);
    // Attempt to "undo" Identity Server registration would be complex and depends on Identity Server API.
    // For now, log and report error. Manual cleanup might be needed if this step fails.
    return { success: false, message: `User registered with Identity Server, but failed to create local record: ${error.message}` };
  }
}
      