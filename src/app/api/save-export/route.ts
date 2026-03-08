import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const metadata = JSON.parse(formData.get('metadata') as string);
    
    if (!file || !metadata) {
      return NextResponse.json({ success: false, error: 'Missing file or metadata' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `exports/${metadata.userId}/${metadata.treeId}/${Date.now()}_${metadata.fileName}`;
    
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(path);
    
    await fileRef.save(buffer, { 
      contentType: file.type,
    });
    
    await fileRef.makePublic();
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${path}`;
    
    await adminDb.collection('exportedFiles').add({
      ...metadata,
      storagePath: path,
      downloadURL,
      fileSizeBytes: buffer.length,
      createdAt: Timestamp.now(),
    });
    
    return NextResponse.json({ success: true, downloadURL });

  } catch (error: any) {
    console.error('API Save Export Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
