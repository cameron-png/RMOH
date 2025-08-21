
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createGiftbitLink, getGiftbitLink } from '@/lib/giftbit';
import type { Gift, UserProfile } from '@/lib/types';
import { sleep } from '@/lib/utils';
import { addDoc, collection, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase/server';


const createGiftSchema = z.object({
  brandCode: z.string().min(1, "Please select a brand."),
  amountInCents: z.string().transform(val => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal)) return 0;
    return Math.round(numericVal * 100);
  }).pipe(z.number().min(500, "Amount must be at least $5.00.")),
  userId: z.string(),
});


export async function createGift(formData: FormData) {
    const validatedFields = createGiftSchema.safeParse({
        brandCode: formData.get('brandCode'),
        amountInCents: formData.get('amountInCents'),
        userId: formData.get('userId'),
    });

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return {
            success: false,
            message: firstError || "Invalid data provided. Please check the form."
        };
    }
    
    const { brandCode, amountInCents, userId } = validatedFields.data;
    
    const userDocRef = adminDb.collection('users').doc(userId);

    try {
        const giftId = uuidv4();
        const giftDocRef = doc(db, 'gifts', giftId);

        // Balance Check
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            throw new Error("User not found.");
        }
        const user = userDoc.data() as UserProfile;
        const currentBalance = user.availableBalance || 0;

        if (currentBalance < amountInCents) {
            throw new Error("Insufficient funds. Please add more to your balance.");
        }

        // 1. Immediately create a "processing" gift in Firestore
        const newGift: Omit<Gift, 'id'> = {
            userId: userId,
            brandCode: brandCode,
            brandName: 'Unknown', // Will be updated later
            amountInCents,
            status: 'processing',
            createdAt: Timestamp.now(), 
        };
        await addDoc(collection(db, 'gifts'), { ...newGift, id: giftId });
        revalidatePath('/user/gifts');

        // Trigger background processing, but don't wait for it
        processGiftInBackground(giftId, brandCode, amountInCents);
        
        return { 
            success: true, 
            message: 'Your gift is being processed! It will appear in the log shortly.'
        };

    } catch (error: any) {
        console.error('Error initiating gift creation:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

async function processGiftInBackground(giftId: string, brandCode: string, amountInCents: number) {
    const giftDocRef = doc(db, 'gifts', giftId);
    try {
        // Step 1: POST to create the gift order with our unique ID.
        await createGiftbitLink({
            brand_codes: [brandCode],
            price_in_cents: amountInCents,
            id: giftId,
        });

        // Step 2: Poll for the generated link details using the same ID.
        let giftbitResponse;
        const maxRetries = 10;
        const retryDelay = 3000; // 3 seconds

        for (let i = 0; i < maxRetries; i++) {
            await sleep(retryDelay);
            try {
                giftbitResponse = await getGiftbitLink(giftId);
                if (giftbitResponse?.links?.[0]) {
                    break; // Success, exit loop
                }
            } catch (error) {
                console.log(`Polling attempt ${i + 1} for gift ${giftId} failed, retrying...`);
            }
        }
        
        const linkDetails = giftbitResponse?.links?.[0];

        if (!linkDetails || !linkDetails.short_id || !linkDetails.claim_url) {
             console.error(`Invalid Giftbit GET response structure for gift ${giftId}:`, giftbitResponse);
             throw new Error("Could not retrieve the generated gift link from Giftbit after several attempts.");
        }

        const giftDataToUpdate = {
            brandName: linkDetails.brands?.[0]?.name || brandCode,
            status: 'available' as const,
            shortId: linkDetails.short_id,
            claimUrl: linkDetails.claim_url,
        };
        
        // 3. Update the gift document with the details
        await updateDoc(giftDocRef, giftDataToUpdate);
        
    } catch (error: any) {
        console.error(`Error processing gift ${giftId} in background:`, error);
        await updateDoc(giftDocRef, {
            status: 'failed',
            errorMessage: error.message || 'An unexpected error occurred during processing.'
        });
    }
}