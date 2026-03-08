import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '@/firebase/config';

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: firebaseConfig.storageBucket,
    });
  }
} catch (error: any) {
  console.error('Firebase Admin initialization error', error);
}

export const adminDb = getFirestore();
export const adminStorage = getStorage();
