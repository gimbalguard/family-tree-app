import admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors
if (!admin.apps.length) {
  try {
    // When running in a Google Cloud environment (like App Hosting),
    // calling initializeApp() with no arguments will automatically
    // discover credentials and project configuration.
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

const firestoreAdmin = admin.firestore();
const storageAdmin = admin.storage();
const authAdmin = admin.auth();

export { firestoreAdmin, storageAdmin, authAdmin, admin };
