// src/lib/firebase/server.ts
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp();
} else {
  adminApp = getApp();
}

const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);
const adminAuth = getAuth(adminApp);

export { adminDb, adminStorage, adminApp, adminAuth };
