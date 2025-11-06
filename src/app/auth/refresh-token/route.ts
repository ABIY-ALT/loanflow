
// src/app/api/auth/refresh-token/route.ts
import { NextResponse } from 'next/server';
import { refreshAccessToken } from '@/app/auth/actions';

export async function POST() {
    // This entire route is now obsolete with the self-contained JWT session model.
    // A client-side call to this endpoint is no longer necessary.
    // Returning a clear error message.
    return NextResponse.json(
        { success: false, error: 'Token refresh functionality is deprecated in the current authentication system.' },
        { status: 410 } // 410 Gone
    );
}
