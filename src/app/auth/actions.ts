
'use server';

import { cookies } from 'next/headers';
import type { User } from '@/types/loan'; // Assuming User type is updated for JWT claims
import { jwtDecode } from 'jwt-decode'; // Using jwt-decode to parse token claims

// Helper function to parse JWT and map to User type
// In a real app, you'd also validate the token signature here using a library like 'jose'
function parseAndMapJwtToUser(token: string): User | null {
  try {
    const decoded: any = jwtDecode(token); // Use 'any' for flexibility with claims
    // console.log("Decoded JWT claims:", decoded);

    // Map JWT claims to your User type
    // Ensure claim names match exactly what's in your JWT
    const user: User = {
      id: decoded.sub, // Subject (user ID)
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      fullName: decoded.unique_name || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim(),
      phoneNumber: decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'],
      role: decoded.role, // Role claim
      // Add other claims as needed
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
    // console.log(`Attempting login for phone: ${phoneNumberInput} to ${identityServiceUrl}/api/auth/login`);
    const response = await fetch(`${identityServiceUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumberInput, password: passwordInput }),
    });

    const data = await response.json();
    // console.log("Login response from identity service:", data);

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

    // Store tokens in HTTP-only cookies
    const cookieStore = cookies();
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // maxAge: decodedToken.exp ? decodedToken.exp - Math.floor(Date.now() / 1000) : 3600, // Set dynamically
    });
    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Consider a longer maxAge for refresh token, e.g., 7 days
    });
    // console.log("Tokens set in cookies. User parsed:", user);
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

  // Always clear local cookies regardless of identity service call success
  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');
  // console.log("Local tokens cleared from cookies.");

  if (!identityServiceUrl) {
    // Log an error but still consider logout successful locally
    console.error("Identity service URL not configured for server-side logout call.");
    return { success: true }; // Local logout successful
  }

  if (!accessToken || !refreshToken) {
    // console.log("No tokens found to send to identity service for logout. Local logout completed.");
    return { success: true }; // Local logout successful
  }

  try {
    // console.log("Calling identity service logout endpoint...");
    const response = await fetch(`${identityServiceUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken, refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // console.error("Logout failed on identity service:", errorData);
      // Even if server logout fails, client-side session is cleared, so proceed.
      // You might want to log this server-side for monitoring.
    } else {
      // console.log("Successfully logged out from identity service.");
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error calling identity service logout:", error);
    // Local logout is already done, so still return success.
    return { success: true };
  }
}

// Placeholder for refresh token logic
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
      // If refresh fails, logout the user by clearing cookies
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

// New Server Action to get current user from token (used by AuthContext)
export async function getCurrentUser(): Promise<{ user: User | null }> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return { user: null };
  }
  // Here, you'd typically validate the token against the JWT_SECRET_KEY
  // For simplicity, we'll just parse. In production, VALIDATE THE SIGNATURE.
  // Example validation using 'jose' (install it: npm install jose):
  /*
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
    const { payload } = await jwtVerify(accessToken, secret, {
      issuer: 'LoanFlowAuthServer', // Expected issuer
      audience: 'LoanFlowAuthClient', // Expected audience
    });
    // payload now contains the validated claims
    const user = parseAndMapJwtToUser(accessToken); // or map from payload
    return { user };
  } catch (err) {
    console.error("Token validation failed or token expired:", err);
    // If token is invalid/expired, try to refresh it
    const refreshResult = await refreshAccessToken();
    if (refreshResult.success && refreshResult.newAccessToken) {
      const user = parseAndMapJwtToUser(refreshResult.newAccessToken);
      return { user };
    }
    // If refresh also fails, clear tokens and return null user
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    return { user: null };
  }
  */
  // Simplified parsing for now:
  const user = parseAndMapJwtToUser(accessToken);
  return { user };
}
