import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
    if (getApps().length > 0) {
        return getApp();
    }

    // This logic allows the app to work in both the local prototyper and the deployed environment.
    // In a deployed environment, initializeApp() automatically finds the credentials.
    // In the local prototyper, it uses a service account key file if the path is provided
    // via a FIREBASE_SERVICE_ACCOUNT_KEY_PATH environment variable.
    if (process.env.NODE_ENV !== 'production' && process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
        try {
            // The `require` syntax is used here to dynamically load the JSON file
            // based on the environment variable path.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
            console.log("Initializing Firebase Admin SDK with local service account.");
            return initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (error) {
            console.error("Failed to initialize Firebase Admin with service account. Make sure the path is correct.", error);
            // Fallback to default initialization if the key is invalid or not found
            return initializeApp();
        }
    } else {
        // Default initialization for deployed environments like Firebase App Hosting
        console.log("Initializing Firebase Admin SDK for a deployed environment.");
        return initializeApp();
    }
}

const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminApp, adminDb, adminAuth, adminStorage };
