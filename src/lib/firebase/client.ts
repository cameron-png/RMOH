
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "openhouse-dashboard",
  appId: "1:892612163678:web:2f8096ab4602e153a01ccf",
  storageBucket: "rmoh-user-files",
  apiKey: "AIzaSyC_hfCUrT85QWTkj9qaN5WWWinGuwBvuLw",
  authDomain: "openhouse-dashboard.firebaseapp.com",
  messagingSenderId: "892612163678",
};

// Client-side app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
