
import { NextResponse, type NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

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
  requestHeaders.set('Content-Security-Policy', cspHeader);
  
  // No special handling for public routes in this middleware; AuthProvider handles it.
  // This middleware's primary job is now session validation for protected routes.

  // 4. Decrypt the session cookie
  const sessionCookie = request.cookies.get('session')?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;

  // 5. If there's no valid session and the route is protected, redirect to login
  if (!session && !publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // 6. If there is a session, but password change is needed and not on the right page, redirect
  if (session && !session.isPasswordChanged && pathname !== '/force-password-change' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/force-password-change', request.url));
  }
  
  // 7. If user is logged in and tries to access login page, redirect to home
  if (session && session.isPasswordChanged && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url));
  }


  // 8. Create the response with the updated headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Set remaining security headers on the final response
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return response;
}

// 9. Apply middleware to ALL routes except Next.js internals and static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|uploads)).*)',
  ],
};
