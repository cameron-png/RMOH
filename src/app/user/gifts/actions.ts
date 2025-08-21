
'use server';

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase/server';
import { Gift } from '@/lib/types';

interface CreateGiftParams {
    userId: string;
    recipientName: string;
    recipientEmail: string;
    brandCode: string;
    amountInCents: number;
}

export async function createGift(params: CreateGiftParams) {
    try {
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
        await addDoc(giftsCollectionRef, newGift);

        return { success: true };

    } catch (error: any) {
        console.error("Error creating gift in Firestore: ", error);
        return { success: false, message: error.message || "Failed to create gift record in the database." };
    }
}
