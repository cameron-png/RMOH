
import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
    // Check if the app is already initialized
    if (getApps().length > 0) {
        return getApp();
    }

    // If not initialized, initialize it.
    // In a deployed Firebase environment (like App Hosting), Google automatically provides
    // the necessary configuration, and initializeApp() works without arguments.
    // For local development (like the Prototyper), the GOOGLE_APPLICATION_CREDENTIALS
    // environment variable should be set to the path of your service account key file.
    // The Firebase CLI and Prototyper often handle this for you.
    // This simplified approach is more robust and less error-prone than manual credential handling.
    console.log("Initializing Firebase Admin SDK...");
    return initializeApp();
}

const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminApp, adminDb, adminAuth, adminStorage };
