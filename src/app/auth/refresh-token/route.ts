
// src/app/api/auth/refresh-token/route.ts
import { NextResponse } from 'next/server';
import { refreshAccessToken } from '@/app/auth/actions';

export async function POST() {
  try {
    const result = await refreshAccessToken();

    if (result.success && result.newAccessToken) {
      // The refreshAccessToken server action already sets the cookies.
      // We just confirm success to the client.
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Token refresh failed at server action level.' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('[API /api/auth/refresh-token] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred during token refresh.' }, { status: 500 });
  }
}
