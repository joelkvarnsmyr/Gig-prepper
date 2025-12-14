/**
 * File Upload API Endpoint
 * Handles PDF and image uploads for rider analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/ai/memory';

// Allowed MIME types
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

// Max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `File type not supported: ${file.type}`,
          allowedTypes: ALLOWED_TYPES,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          maxSize: MAX_FILE_SIZE,
        },
        { status: 400 }
      );
    }

    // Read file content as base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');

    // Determine file type category
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    // Store in session if provided
    let storedFile = null;
    if (sessionId) {
      const session = sessionManager.get(sessionId);
      if (session) {
        storedFile = sessionManager.addUploadedFile(sessionId, {
          filename: file.name,
          mimeType: file.type,
          content: base64Content,
        });
      }
    }

    return NextResponse.json({
      success: true,
      file: {
        id: storedFile?.id || null,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        isImage,
        isPDF,
        // Only include base64 content if not stored in session
        // (caller will need it for the chat request)
        content: sessionId ? undefined : base64Content,
      },
      sessionId: sessionId || null,
      message: isImage
        ? 'Bild uppladdad. Skicka den i chatten för analys.'
        : 'PDF uppladdad. Skicka den i chatten för analys.',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - get uploaded files for a session
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId required' },
      { status: 400 }
    );
  }

  const session = sessionManager.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    files: session.uploadedFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      parsed: f.parsed,
      uploadedAt: f.uploadedAt,
    })),
  });
}
