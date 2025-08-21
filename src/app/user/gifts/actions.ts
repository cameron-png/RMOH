
'use server';

import { addDoc, collection, doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile } from '@/lib/types';

interface CreateGiftParams {
    userId: string;
    recipientName: string;
    recipientEmail: string;
    brandCode: string;
    amountInCents: number;
}

export async function createGift(params: CreateGiftParams) {
    try {
        const userDocRef = doc(adminDb, 'users', params.userId);

        await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User document not found.");
            }

            const userData = userDoc.data() as UserProfile;
            const currentBalance = userData.availableBalance || 0;

            if (currentBalance < params.amountInCents) {
                throw new Error("Insufficient funds.");
            }

            const newBalance = currentBalance - params.amountInCents;
            transaction.update(userDocRef, { availableBalance: newBalance });

            const newGift: Omit<Gift, 'id'> = {
                userId: params.userId,
                recipientName: params.recipientName,
                recipientEmail: params.recipientEmail,
                brandCode: params.brandCode,
                amountInCents: params.amountInCents,
                type: 'Manual',
                status: 'Pending',
                createdAt: Timestamp.now(),
            };

            const giftsCollectionRef = collection(adminDb, "gifts");
            transaction.set(doc(giftsCollectionRef), newGift);
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error creating gift in Firestore: ", error);
        return { success: false, message: error.message || "Failed to create gift record in the database." };
    }
}
