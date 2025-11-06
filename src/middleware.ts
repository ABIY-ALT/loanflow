
import { NextResponse, type NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Generate a nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // 2. Session check using the 'session' cookie
  const sessionCookie = request.cookies.get('session')?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;
  const isAuthenticated = !!session;

  // 3. Auth/Protected routes logic
  const isAuthPage = pathname === '/login' || pathname === '/force-password-change';

  let response: NextResponse;

  // Redirect to login if not authenticated and not on an auth page
  if (!isAuthenticated && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    response = NextResponse.redirect(url);
  } 
  // Redirect to dashboard if authenticated and trying to access a public/auth page
  // (Exception for force-password-change)
  else if (isAuthenticated && isAuthPage) {
    // A user might be authenticated but needs to change their password.
    // We get the user data from the session if available to check this.
    // Note: The logic in AuthProvider is the primary guard for this.
    // This is a secondary check in the middleware.
    const userNeedsPasswordChange = session?.isPasswordChanged === false;

    if (pathname === '/force-password-change' && userNeedsPasswordChange) {
      // Allow access to the password change page if they need to be there.
      response = NextResponse.next();
    } else if (pathname === '/force-password-change' && !userNeedsPasswordChange) {
      // If they don't need to be there, redirect away.
      const url = request.nextUrl.clone();
      url.pathname = '/';
      response = NextResponse.redirect(url);
    }
    else {
      // If they are authenticated and on the login page, redirect to dashboard.
      const url = request.nextUrl.clone();
      url.pathname = '/';
      response = NextResponse.redirect(url);
    }
  } 
  // Otherwise, continue with the request
  else {
    response = NextResponse.next();
  }

  // Clear cookie if session is invalid but cookie exists (e.g., expired)
  if (!session && sessionCookie) {
    response.cookies.delete('session');
  }

  // Set the nonce in the request headers to be accessible in the layout
  response.headers.set('x-nonce', nonce);

  // 4. Strong security headers
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

// 5. Apply middleware to ALL routes except Next.js internals and static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|uploads)).*)',
  ],
};
