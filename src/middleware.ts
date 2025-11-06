
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. Generate a nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // The primary authentication and redirect logic is now centralized in AuthProvider.
  // The middleware will now focus on setting security headers and other non-auth tasks.

  const response = NextResponse.next();

  // Set the nonce in the request headers to be accessible in the layout
  response.headers.set('x-nonce', nonce);

  // 2. Strong security headers
  const cspHeader = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
      style-src 'self' 'unsafe-inline';
      img-src 'self' https://placehold.co https://play-lh.googleusercontent.com data:;
      connect-src 'self';
      font-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
    `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return response;
}

// 3. Apply middleware to ALL routes except Next.js internals and static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|uploads)).*)',
  ],
};
