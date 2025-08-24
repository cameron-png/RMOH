import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// In a Google Cloud environment like App Hosting, the SDK automatically
// finds the project's service account credentials. No explicit configuration
// is needed.
function initializeAdminApp(): App {
    if (getApps().length > 0) {
        return getApp();
    }
    
    // This simple initialization is all that's needed for App Hosting.
    return initializeApp();
}

const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminDb, adminAuth, adminStorage };
