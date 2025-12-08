// src/app/api/downloads/[...filepath]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';

export async function GET(
  request: NextRequest,
  { params }: { params: { filepath: string[] } }
) {
  // 1. Check for authenticated user session
  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) {
    return new NextResponse('Authentication required.', { status: 401 });
  }

  const session = await decrypt(sessionCookie);
  if (!session || !session.userId) {
    return new NextResponse('Invalid or expired session.', { status: 403 });
  }

  // 2. Safely construct the file path
  const relativeFilePath = params.filepath.join('/');
  
  // Basic path traversal check
  if (relativeFilePath.includes('..')) {
      return new NextResponse('Invalid file path.', { status: 400 });
  }

  const absoluteFilePath = path.join(process.cwd(), 'storage', relativeFilePath);

  try {
    // 3. Read the file from the secure location
    const fileBuffer = await fs.readFile(absoluteFilePath);
    
    // 4. Determine the content type
    const contentType = mime.lookup(absoluteFilePath) || 'application/octet-stream';

    // 5. Create the response with appropriate headers for secure download
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Forces browser to download rather than display inline, crucial for HTML/SVG
        'Content-Disposition': `attachment; filename="${path.basename(absoluteFilePath)}"`,
        // Prevents browser from interpreting file as a different content type
        'X-Content-Type-Options': 'nosniff',
      },
    });

    return response;

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('File not found.', { status: 404 });
    }
    console.error('File download error:', error);
    return new NextResponse('An internal error occurred while trying to access the file.', { status: 500 });
  }
}
