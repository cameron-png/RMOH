// src/lib/firebase/server.ts
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';

// Initialize the app only if it's not already been initialized.
if (!getApps().length) {
  initializeApp();
}

export const adminApp: App = getApp();
export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
