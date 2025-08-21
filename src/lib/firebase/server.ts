// src/lib/firebase/server.ts
import { getApps as getAdminApps, getApp as getAdminApp, initializeApp as initializeAdminApp, type App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';


let adminApp: AdminApp;

if (getAdminApps().length === 0) {
  adminApp = initializeAdminApp();
} else {
  adminApp = getAdminApp();
}


const adminDb = getAdminFirestore(adminApp);
const adminStorage = getAdminStorage(adminApp);
const adminAuth = getAdminAuth(adminApp);

export { adminDb, adminStorage, adminApp, adminAuth };
