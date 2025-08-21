// src/lib/firebase/server.ts
import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp();
}

function getAdminDb(): Firestore {
    return getFirestore(getAdminApp());
}

function getAdminStorage(): Storage {
    return getStorage(getAdminApp());
}

function getAdminAuth(): Auth {
    return getAuth(getAdminApp());
}


export const adminApp = getAdminApp();
export const adminDb = getAdminDb();
export const adminStorage = getAdminStorage();
export const adminAuth = getAdminAuth();
