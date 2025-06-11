
// src/lib/auth-utils.ts
// This file would contain utilities for JWT validation.
// For now, it's a placeholder.
// In a real application, you'd use a library like 'jose' here.
// import { jwtVerify } from 'jose'; // Example import

interface DecodedJwt {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  unique_name: string;
  role: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
  [key: string]: any; // Allow other claims
}

// This is a conceptual function. Actual validation is more complex.
export async function validateAndDecodeJwt(token: string): Promise<DecodedJwt | null> {
  const jwtSecret = process.env.JWT_SECRET_KEY;
  if (!jwtSecret) {
    console.error("JWT_SECRET_KEY is not defined. Cannot validate token.");
    // In a real app, you might throw an error or handle this more gracefully.
    // For now, for client-side parsing or non-signature-critical paths, we might proceed with decoding only.
    // However, server-side validation MUST have the secret.
    // This function as is, is more like a parser than a validator for server-side.
  }

  try {
    // **IMPORTANT**: jwt-decode DOES NOT validate the token signature.
    // It only decodes the payload. For proper validation on the server,
    // you MUST use a library like 'jose' or 'jsonwebtoken' and verify the signature.
    const { jwtDecode } = await import('jwt-decode'); // Dynamic import for client/server flexibility if needed elsewhere
    const decoded = jwtDecode<DecodedJwt>(token);

    // Basic expiration check (if exp claim exists)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      console.warn("Token has expired.");
      return null;
    }
    
    // TODO: Add signature verification using `jose` or similar on the server-side
    // Example with `jose` (conceptual, needs actual implementation):
    /*
    if (jwtSecret && typeof window === 'undefined') { // Only run signature validation on server
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'LoanFlowAuthServer', // Expected issuer from your JWT
        audience: 'LoanFlowAuthClient', // Expected audience from your JWT
      });
      return payload as DecodedJwt; // payload from jwtVerify is already validated
    }
    */

    return decoded;
  } catch (error) {
    console.error("Error decoding or validating JWT:", error);
    return null;
  }
}
