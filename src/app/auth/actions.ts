
'use server';

import { cookies } from 'next/headers';
import type { User } from '@/types/loan';
import { jwtDecode } from 'jwt-decode';

// Helper function to parse JWT and map to User type
function parseAndMapJwtToUser(token: string): User | null {
  try {
    const decoded: any = jwtDecode(token);

    const user: User = {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      fullName: decoded.unique_name || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim(),
      phoneNumber: decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'],
      role: decoded.role,
    };
    return user;
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}


export async function loginUser(phoneNumberInput: string, passwordInput: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  if (!identityServiceUrl) {
    return { success: false, error: "Identity service URL is not configured." };
  }

  try {
    console.log("Attempting to login with phone number:", phoneNumberInput);
    console.log("Using identity service URL:", identityServiceUrl+ '/api/auth/login');
    const response = await fetch(`${identityServiceUrl}api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumberInput, password: passwordInput }),
    });

    console.log("Response status:", response.status);

    const data = await response.json();

    if (!response.ok || !data.isSuccess) {
      return { success: false, error: data.errors?.[0]?.description || data.errors || 'Login failed from identity service.' };
    }

    const { accessToken, refreshToken } = data;

    if (!accessToken || !refreshToken) {
      return { success: false, error: "Access token or refresh token missing in response." };
    }

    const user = parseAndMapJwtToUser(accessToken);
    if (!user) {
      return { success: false, error: "Failed to parse user details from access token." };
    }

    const cookieStore = cookies();
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { success: true, user };

  } catch (error: any) {
    console.error("Network or unexpected error during login:", error);
    return { success: false, error: error.message || 'An unexpected error occurred during login.' };
  }
}

export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  const cookieStore = cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshToken = cookieStore.get('refreshToken')?.value;

  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');

  if (!identityServiceUrl) {
    console.error("Identity service URL not configured for server-side logout call.");
    return { success: true };
  }

  if (!accessToken || !refreshToken) {
    return { success: true };
  }

  try {
    const response = await fetch(`${identityServiceUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken, refreshToken }),
    });

    if (!response.ok) {
      // const errorData = await response.json();
      // console.error("Logout failed on identity service:", errorData);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error calling identity service logout:", error);
    return { success: true };
  }
}

export async function refreshAccessToken(): Promise<{ success: boolean; newAccessToken?: string; error?: string }> {
  const identityServiceUrl = process.env.NEXT_PUBLIC_IDENTITY_SERVICE_URL;
  const cookieStore = cookies();
  const currentAccessToken = cookieStore.get('accessToken')?.value;
  const currentRefreshToken = cookieStore.get('refreshToken')?.value;

  if (!identityServiceUrl || !currentAccessToken || !currentRefreshToken) {
    return { success: false, error: "Missing configuration or tokens for refresh." };
  }

  try {
    const response = await fetch(`${identityServiceUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentAccessToken, refreshToken: currentRefreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.isSuccess) {
      cookieStore.delete('accessToken');
      cookieStore.delete('refreshToken');
      return { success: false, error: data.errors?.[0]?.description || 'Failed to refresh token.' };
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data;
    cookieStore.set('accessToken', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    cookieStore.set('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

    return { success: true, newAccessToken };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred during token refresh.' };
  }
}

export async function getCurrentUser(): Promise<{ user: User | null }> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return { user: null };
  }
  // IMPORTANT: In a production environment, you MUST validate the token signature here
  // using a library like 'jose' and your JWT secret or public key.
  // The 'jwt-decode' library only decodes the payload and does not verify authenticity.
  // Example (conceptual, needs actual 'jose' setup):
  /*
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
    const { payload } = await jwtVerify(accessToken, secret, {
      issuer: 'LoanFlowAuthServer',
      audience: 'LoanFlowAuthClient',
    });
    const user = parseAndMapJwtToUser(accessToken); // or map from payload
    return { user };
  } catch (err) {
    console.error("Token validation failed or token expired:", err);
    // Attempt to refresh token, then clear if refresh fails
    return { user: null };
  }
  */
  const user = parseAndMapJwtToUser(accessToken);
  return { user };
}

