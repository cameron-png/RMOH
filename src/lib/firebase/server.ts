import { initializeApp, getApps, getApp, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function getServiceAccount(): ServiceAccount | undefined {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
        // In a deployed Google Cloud environment, these are often not needed.
        // The SDK can automatically detect the service account.
        return undefined;
    }

    return {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
    };
}


function initializeAdminApp(): App {
    // Check if the app is already initialized
    if (getApps().length > 0) {
        return getApp();
    }
    
    const serviceAccount = getServiceAccount();

    if (serviceAccount) {
        // Running in a local/dev environment with service account credentials
        return initializeApp({
            credential: cert(serviceAccount)
        });
    } else if (process.env.GCLOUD_PROJECT) {
        // Running in a Google Cloud environment (like App Hosting)
        // with Application Default Credentials
        return initializeApp();
    } else {
        // Fallback for environments where credentials are not explicitly set
        // or implicitly available. This might still fail if no credentials
        // can be found, but it's the standard initialization attempt.
        console.warn("Firebase Admin SDK is being initialized without explicit credentials. This might fail if Application Default Credentials are not available.");
        return initializeApp();
    }
}


const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminDb, adminAuth, adminStorage };
