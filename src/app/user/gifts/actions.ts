
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/server';
import type { Gift } from '@/lib/types';

interface CreateGiftParams {
    userId: string;
    recipientName: string;
    recipientEmail: string;
    brandCode: string;
    amountInCents: number;
}

export async function createGift(params: CreateGiftParams) {
    try {
        const giftsCollectionRef = adminDb.collection("gifts");

        // Construct the new gift object, adhering to the Gift type
        const newGift: Omit<Gift, 'id'> = {
            userId: params.userId,
            recipientName: params.recipientName,
            recipientEmail: params.recipientEmail,
            brandCode: params.brandCode,
            amountInCents: params.amountInCents,
            type: 'Manual',
            status: 'Pending',
            claimUrl: null, 
            createdAt: Timestamp.now(),
        };

        await giftsCollectionRef.add(newGift);

        return { success: true };

    } catch (error: any) {
        console.error("Error creating gift in Firestore: ", error);
        return { success: false, message: error.message || "Failed to create gift record in the database." };
    }
}
