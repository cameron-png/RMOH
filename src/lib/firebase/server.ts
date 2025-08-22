
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// This is the key to the fix: a singleton pattern for the Firebase Admin app.
// It ensures that we're not trying to re-initialize the app on every server-side render or action.
const adminApp = !getApps().length ? initializeApp() : getApp();

const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminDb, adminAuth, adminStorage };
