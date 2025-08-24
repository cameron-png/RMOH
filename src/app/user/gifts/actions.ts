
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile, GiftbitBrand, AppSettings, OpenHouse, Transaction } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import * as z from 'zod';

const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;
const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';
const LOW_BALANCE_THRESHOLD = 2500; // $25 in cents

const giftFormSchema = z.object({
  recipientName: z.string().min(2),
  recipientEmail: z.string().email(),
  brandCode: z.string().min(1),
  amount: z.string().min(1),
  message: z.string().optional(),
});


async function createGiftbitGift(gift: Gift): Promise<any> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }
    
    const response = await fetch(`${GIFTBIT_BASE_URL}/gifts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GIFTBIT_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: gift.id, // Use Firestore doc ID for idempotency
            price_in_cents: gift.amountInCents,
            brand_code: gift.brandCode,
            delivery_format: "SHORT_LINK", // We need the link to email ourselves
            recipient_name: gift.recipientName,
            recipient_email: gift.recipientEmail,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Giftbit API Error (${response.status}):`, errorBody);
        throw new Error(`Giftbit API request failed with status ${response.status}`);
    }

    return await response.json();
}

async function processGift(giftId: string, authenticatedUserId: string) {
    const giftRef = adminDb.collection('gifts').doc(giftId);

    try {
        const giftDoc = await giftRef.get();
        if (!giftDoc.exists) throw new Error('Gift not found');
        
        // Security Check: Ensure the authenticated user owns this gift.
        const gift = { id: giftDoc.id, ...giftDoc.data() } as Gift;
        if (gift.userId !== authenticatedUserId) {
            throw new Error('Permission denied. You do not own this gift.');
        }

        const userRef = adminDb.collection('users').doc(gift.userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User not found');
        const user = userDoc.data() as UserProfile;
        
        // Check balance again on the server side for security
        if ((user.availableBalance || 0) < gift.amountInCents) {
            throw new Error('Insufficient funds.');
        }
        
        let openHouseAddress: string | undefined = undefined;
        if (gift.openHouseId) {
            const houseDoc = await adminDb.collection('openHouses').doc(gift.openHouseId).get();
            if (houseDoc.exists) {
                openHouseAddress = (houseDoc.data() as OpenHouse).address;
            }
        }

        // Fetch brand details to get the brand name if it's not already on the gift
        const brandName = gift.brandName || (await (async () => {
            if (!GIFTBIT_API_KEY) return gift.brandCode;
            try {
                const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
                const settings = settingsDoc.data() as AppSettings;
                const enabledBrands = settings?.giftbit?.enabledBrands || [];
                const selectedBrandData = enabledBrands.find((b: GiftbitBrand) => b.brand_code === gift.brandCode);
                return selectedBrandData?.name || gift.brandCode;
            } catch (e) {
                console.error("Could not fetch brand name, falling back to brand code", e);
                return gift.brandCode;
            }
        })());


        // 1. Create the gift order
        const orderResponse = await createGiftbitGift(gift);
        
        // 2. Extract the claim URL from the response
        const claimUrl = orderResponse?.gift?.short_link;

        if (!claimUrl) {
            console.error('No claim URL found in Giftbit response for gift:', gift.id, 'Response:', orderResponse);
            throw new Error(`Link generation failed for gift ${gift.id}. No URL in response.`);
        }
        
        // 3. Update gift in Firestore, deduct balance, and create transaction atomically
        const newTransactionRef = adminDb.collection('transactions').doc();
        const newTransaction: Omit<Transaction, 'id'> = {
            userId: user.id,
            type: 'Deduction',
            amountInCents: gift.amountInCents,
            description: `Gift to ${gift.recipientName} (${gift.recipientEmail})`,
            createdAt: Timestamp.now(),
            giftId: gift.id,
            createdById: user.id,
        };
        
        await adminDb.runTransaction(async (transaction) => {
             transaction.update(userRef, {
                availableBalance: FieldValue.increment(-gift.amountInCents)
            });
            transaction.update(giftRef, {
                status: 'Sent',
                claimUrl: claimUrl,
                brandName: brandName,
            });
            transaction.set(newTransactionRef, newTransaction);
        });

        // 4. Send email to recipient
        await sendGiftEmail({
            ...gift,
            brandName: brandName,
            claimUrl: claimUrl,
            sender: user,
            openHouseAddress: openHouseAddress,
        });
        
        // 5. Check for low balance and send notification if needed
        const newBalance = (user.availableBalance || 0) - gift.amountInCents;
        if (newBalance < LOW_BALANCE_THRESHOLD) {
            await sendLowBalanceEmail({ user: { ...user, id: gift.userId }, currentBalanceInCents: newBalance });
        }

    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        await giftRef.update({ status: 'Failed', claimUrl: null }); // Ensure claimUrl is cleared on failure
        // Re-throw the error to be caught by the calling function
        throw error;
    }
}

interface SendManualGiftParams extends z.infer<typeof giftFormSchema> {
    userId: string;
}

export async function sendManualGift(params: SendManualGiftParams): Promise<{ success: boolean; message?: string; }> {
    const { userId, ...giftData } = params;

    if (!userId) {
        return { success: false, message: "User not authenticated." };
    }

    try {
        const giftId = uuidv4();
        const giftRef = adminDb.collection('gifts').doc(giftId);

        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User profile not found');
        const user = {id: userDoc.id, ...userDoc.data()} as UserProfile;

        const amountInCents = Math.round(parseFloat(giftData.amount) * 100);

        if ((user.availableBalance || 0) < amountInCents) {
            return { success: false, message: 'Insufficient funds.' };
        }
        
        const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
        const settings = settingsDoc.data() as AppSettings;
        const enabledBrands = settings?.giftbit?.enabledBrands || [];
        const selectedBrandData = enabledBrands.find((b: GiftbitBrand) => b.brand_code === giftData.brandCode);

        const newGift: Gift = {
            id: giftId,
            userId: userId,
            recipientName: giftData.recipientName,
            recipientEmail: giftData.recipientEmail,
            brandCode: giftData.brandCode,
            brandName: selectedBrandData?.name || giftData.brandCode,
            amountInCents: amountInCents,
            message: giftData.message,
            type: 'Manual',
            status: 'Pending', // Start as pending, processGift will update it
            claimUrl: null,
            createdAt: Timestamp.now(),
        };

        // Create the gift document in Firestore first
        await giftRef.set(newGift);

        // Now, process the gift immediately, passing the authenticated user's ID
        await processGift(giftId, userId);

        return { success: true };

    } catch (error: any) {
        console.error("Error in sendManualGift server action:", error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}


export async function confirmPendingGift(giftId: string, userId: string): Promise<{ success: boolean, message?: string }> {
    if (!userId) {
        return { success: false, message: "User not authenticated." };
    }
    
    try {
        // The processGift function will handle checking if the user owns the gift.
        await processGift(giftId, userId);
        return { success: true };
    } catch (error: any) {
        console.error(`Error confirming gift ${giftId}:`, error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function declinePendingGift(giftId: string, userId: string): Promise<{ success: boolean, message?: string }> {
     if (!userId) {
        return { success: false, message: "User not authenticated." };
    }
    
    try {
        const giftRef = adminDb.collection('gifts').doc(giftId);
        const giftDoc = await giftRef.get();
        
        // Security check to ensure the user owns the gift they are declining
        if (!giftDoc.exists || giftDoc.data()?.userId !== userId) {
            return { success: false, message: "Gift not found or permission denied." };
        }
        
        await giftRef.update({ status: 'Cancelled' });
        return { success: true };
    } catch (error: any) {
        console.error(`Error declining gift ${giftId}:`, error);
        return { success: false, message: 'Failed to decline the gift.' };
    }
}
