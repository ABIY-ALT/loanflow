
import { NextResponse, type NextRequest } from 'next/server';

// 1. Specify public routes that do not require authentication
const publicRoutes = ['/login', '/force-password-change'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 2. Generate a nonce for CSP on every request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
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

  // 3. Clone headers to create a new response
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  
  // NOTE: Authentication and redirection logic has been moved to AuthProvider
  // to resolve race conditions between server-side middleware and client-side routing.
  // The provider now handles all auth-based redirects.

  // 4. Create the response with the updated headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Set remaining security headers on the final response
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self)');
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

// 5. Apply middleware to ALL routes except Next.js internals and static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|uploads)).*)',
  ],
};
