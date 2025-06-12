'use server';

import { cookies } from 'next/headers';

import RegisterUserForm from '@/components/RegisterUserForm';
import prisma from '@/lib/prisma'; // Correct import for prisma
import { jwtDecode } from 'jwt-decode';
import { refreshAccessToken } from '@/app/auth/actions'; // Correct import for refreshAccessToken
import { z } from 'zod';

// Define a schema for the user data
const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function registerUserAction(formData: FormData) {
  const result = userSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return { success: false, message: 'Validation failed', errors };
  }

  const userData = result.data;

  const cookieStore = await cookies();
  const adminAccessToken = cookieStore.get('accessToken')?.value;
  const adminRefreshToken = cookieStore.get('refreshToken')?.value;

  if (!adminAccessToken) {
    console.error('Admin access token not found in cookies');
    return { success: false, message: 'Unauthorized: Admin token missing.' };
  }

  const sendRegistrationRequest = async (accessToken: string) => {
    const identityServerResponse = await fetch(`${process.env.IDENTITY_SERVICE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify(userData),
    });

    return identityServerResponse;
  };
  let identityServerResponse = await sendRegistrationRequest(adminAccessToken);

  // Check if the token is expired (status 401) and attempt to refresh if a refresh token is available
  if (identityServerResponse.status === 401 && adminRefreshToken) {
    console.log('Admin access token expired. Attempting to refresh...');
    const refreshResult = await refreshAccessToken();

    if (refreshResult.success && refreshResult.newAccessToken) {
      console.log('Token refreshed successfully. Retrying registration...');
      // Retry the registration request with the new access token
      identityServerResponse = await sendRegistrationRequest(refreshResult.newAccessToken);
    } else {
      console.error('Failed to refresh access token:', refreshResult.error);
      // If refresh fails, indicate that the user needs to reauthenticate
      return { success: false, message: 'Your session has expired. Please log in again.' };
    }
  }

  let identityServerData;
  try {
    identityServerData = await identityServerResponse.json();
  } catch (jsonError) {
    console.error('Failed to parse identity server response as JSON:', jsonError);
    return { success: false, message: `Registration failed: Invalid response from identity server (Status: ${identityServerResponse.status}).` };
  }

  if (!identityServerResponse.ok || !identityServerData.isSuccess) {
    console.error('Identity server response not OK or registration not successful:', identityServerResponse.status, identityServerData);
    const errorMessage = identityServerData.errors ? identityServerData.errors.join(', ') : identityServerData.message || `Identity server returned status ${identityServerResponse.status}.`;
    return { success: false, message: `Registration failed: ${errorMessage}` };
  }

  // If we reach here, the identityServerResponse is OK and identityServerData.isSuccess is true
  try {
    // Step 3 & 4: Decode accessToken and insert into Prisma
    const decodedToken: any = jwtDecode(identityServerData.accessToken);
    const userId = decodedToken.sub;

    // Check if the user already exists in your database based on userId to prevent unique constraint errors
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      console.warn(`User with userId ${userId} already exists in the database.`);
      // Optionally, you could update the existing user instead of returning an error
      // For now, we'll treat it as a successful registration on the identity server side
      return { success: true, message: 'User registered on identity server (already exists in local database).' };
    }

    await prisma.user.create({
      data: {
        id: userId,
        email: userData.email,
        name: userData.firstName + " " + userData.lastName
      },
    });

    return { success: true, message: 'User registered successfully!' };
  } catch (error: any) {
    console.error('Error during user registration:', error);
    // Handle specific errors (e.g., Prisma unique constraint violation) if needed
    if (error.message && error.message.includes('Unique constraint failed')) {
       return { success: false, message: 'User with this email already exists.' };
    }
    // Generic error for other issues during Prisma operation
    return { success: false, message: 'An error occurred during registration.' };
  }
}

export default async function RegisterUserPage() {
  return <RegisterUserForm registerUserAction={registerUserAction} />;
}