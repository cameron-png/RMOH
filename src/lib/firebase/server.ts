import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
    if (getApps().length > 0) {
        return getApp();
    }
    
    // This simple initialization is all that's needed for App Hosting
    // and other Google Cloud environments. The SDK will automatically
    // find the project's service account credentials.
    return initializeApp();
}

const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminApp, adminDb, adminAuth, adminStorage };
