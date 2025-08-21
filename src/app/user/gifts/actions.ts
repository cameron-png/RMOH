
'use server';

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
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
            type: 'Gift Card', // Assuming a static type for now
            status: 'Pending',
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, "gifts"), newGift);
        
        return { success: true, id: docRef.id };

    } catch (error) {
        console.error("Error creating gift in Firestore: ", error);
        return { success: false, message: "Failed to create gift record in the database." };
    }
}
