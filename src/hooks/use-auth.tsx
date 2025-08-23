
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  Auth,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, addDoc } from "firebase/firestore";
import { auth, db } from '@/lib/firebase/client';
import { useRouter } from "next/navigation";
import { UserProfile, Transaction } from "@/lib/types";

export type User = FirebaseUser & UserProfile;


interface AuthContextType {
  user: User | null;
  loading: boolean;
  availableBalance: number;
  refreshUserData: () => Promise<void>;
  signIn: typeof signInWithEmailAndPassword;
  signUp: typeof createUserWithEmailAndPassword;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: typeof sendPasswordResetEmail;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const router = useRouter();
  
  const fetchUserAndCounts = useCallback(async (firebaseUser: FirebaseUser | null): Promise<User | null> => {
    if (!firebaseUser) return null;

    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userProfile = userDocSnap.data() as UserProfile;
          setAvailableBalance(userProfile.availableBalance || 0);
          return { ...firebaseUser, ...userProfile };
        } else {
           console.log(`User profile for ${firebaseUser.uid} not found, creating one.`);
           const initialBalance = 10000; // $100 for new users
           
            const newUserProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'New User',
              phone: '',
              availableBalance: initialBalance,
              createdAt: Timestamp.now(),
              lastLoginAt: Timestamp.now(),
            };
            
            const newTransaction: Omit<Transaction, 'id'> = {
                userId: firebaseUser.uid,
                type: 'Credit',
                amountInCents: initialBalance,
                description: 'Initial account balance',
                createdAt: Timestamp.now(),
                createdById: firebaseUser.uid
            };

            await setDoc(userDocRef, newUserProfile);
            await addDoc(collection(db, "transactions"), newTransaction);

            setAvailableBalance(newUserProfile.availableBalance);
            return { ...firebaseUser, ...newUserProfile };
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        // Return base user to prevent login failure on profile error
        return firebaseUser as User;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const fullUser = await fetchUserAndCounts(firebaseUser);
        setUser(fullUser);
        const idToken = await firebaseUser.getIdToken();
        // Set cookie for server-side authentication
        await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
      } else {
        setUser(null);
        setAvailableBalance(0);
         await fetch('/api/auth/logout', { method: 'POST' });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserAndCounts]);
  
  const refreshUserData = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        setLoading(true);
        const fullUser = await fetchUserAndCounts(currentUser);
        setUser(fullUser);
        setLoading(false);
    }
  }, [fetchUserAndCounts]);

  const signIn = async (authInstance: Auth, email: string, pass: string) => {
    const userCredential = await signInWithEmailAndPassword(authInstance, email, pass);
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    await updateDoc(userDocRef, {
        lastLoginAt: Timestamp.now(),
    });
    return userCredential;
  }

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/');
  };


  const value = {
    user,
    loading,
    availableBalance,
    refreshUserData,
    signIn,
    signUp: (auth: Auth, email:string, p:string) => createUserWithEmailAndPassword(auth, email, p),
    signOut,
    sendPasswordResetEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
