import admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

// Check if the app is already initialized to prevent errors
if (!admin.apps.length) {
  try {
    // When running in a Google Cloud environment (like App Hosting),
    // credentials will be automatically discovered. For local development,
    // you would need to set up the GOOGLE_APPLICATION_CREDENTIALS
    // environment variable.
    admin.initializeApp({
      storageBucket: firebaseConfig.storageBucket,
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

const firestoreAdmin = admin.firestore();
const storageAdmin = admin.storage();
const authAdmin = admin.auth();

export { firestoreAdmin, storageAdmin, authAdmin, admin };
