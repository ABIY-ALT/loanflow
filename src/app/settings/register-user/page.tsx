'use server';

import { cookies } from 'next/headers';

import RegisterUserForm from '@/components/RegisterUserForm';
import prisma from '@/lib/prisma'; // Correct import for prisma
import { jwtDecode } from 'jwt-decode';
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

  const cookieStore = cookies();
  const adminAccessToken = cookieStore.get('accessToken')?.value;

  if (!adminAccessToken) {
    console.error('Admin access token not found in cookies');
    return { success: false, message: 'Unauthorized: Admin token missing.' };
  }

  try {
    // Step 1 & 2: Make POST request to Identity Server
    const identityServerResponse = await fetch(`${process.env.NEXT_PUBLIC_IDENTITY_SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify(userData),
    });

    const identityServerData = await identityServerResponse.json();

    if (!identityServerData.isSuccess) {
      console.error('Identity server registration failed:', identityServerData.errors);
      return { success: false, message: identityServerData.errors ? identityServerData.errors.join(', ') : 'Identity server registration failed.' };
    }

    // Step 3 & 4: Decode accessToken and insert into Prisma
    const decodedToken: any = jwtDecode(identityServerData.accessToken);
    const userId = decodedToken.sub;

    await prisma.user.create({
      data: {
        userId: userId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        email: userData.email,
      },
    });

    return { success: true, message: 'User registered successfully!' };

  } catch (error: any) {
    console.error('Error during user registration:', error);
    // Handle specific errors (e.g., Prisma unique constraint violation) if needed
    if (error.message.includes('Unique constraint failed')) {
       return { success: false, message: 'User with this email already exists.' };
    }
    return { success: false, message: 'An error occurred during registration.' };
  }
}

export default async function RegisterUserPage() {
  return <RegisterUserForm registerUserAction={registerUserAction} />;
}