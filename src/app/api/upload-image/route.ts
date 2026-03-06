import { type NextRequest, NextResponse } from 'next/server';
import { storageAdmin } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const userId = data.get('userId') as string;
    const treeId = data.get('treeId') as string;

    if (!file || !userId || !treeId) {
      return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const bucket = storageAdmin.bucket();
    // Sanitize filename and make it unique
    const filename = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `users/${userId}/trees/${treeId}/photos/${filename}`;
    
    const fileUpload = bucket.file(filePath);

    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Generate a long-lived signed URL for reading the file.
    const [signedUrl] = await fileUpload.getSignedUrl({
      action: 'read',
      expires: '01-01-2500', // A date far in the future.
    });

    return NextResponse.json({ success: true, url: signedUrl });

  } catch (e: any) {
    console.error('Upload API error:', e);
    return NextResponse.json({ success: false, error: 'Image could not be uploaded.' }, { status: 500 });
  }
}
