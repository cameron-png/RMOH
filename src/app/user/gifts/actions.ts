
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile, GiftbitBrand, AppSettings, OpenHouse, Transaction } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import * as z from 'zod';
import { serializeTimestamps } from '@/app/admin/actions';

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
    
    const response = await fetch(`${GIFTBIT_BASE_URL}/direct_links`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GIFTBIT_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: gift.id, // Use Firestore doc ID for idempotency
            price_in_cents: gift.amountInCents,
            brand_codes: [gift.brandCode],
            region: "USA", // Assuming US region for now
            link_count: 1,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Giftbit API Error (${response.status}):`, errorBody);
        throw new Error(`Giftbit API request failed with status ${response.status}`);
    }

    return await response.json();
}

interface SendManualGiftParams extends z.infer<typeof giftFormSchema> {
    userId: string;
}

export async function sendManualGift(params: SendManualGiftParams): Promise<{ success: boolean; message?: string; }> {
    const { userId, ...giftData } = params;

    if (!userId) {
        return { success: false, message: "User not authenticated." };
    }

    const giftId = uuidv4();
    const giftRef = adminDb.collection('gifts').doc(giftId);
    const userRef = adminDb.collection('users').doc(userId);

    try {
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
        
        const newGiftForApi: Gift = {
            id: giftId,
            userId: userId,
            recipientName: giftData.recipientName,
            recipientEmail: giftData.recipientEmail,
            brandCode: giftData.brandCode,
            brandName: selectedBrandData?.name || giftData.brandCode,
            amountInCents: amountInCents,
            message: giftData.message,
            type: 'Manual',
            status: 'Sent', // Will be sent immediately
            claimUrl: null, // To be filled
            createdAt: Timestamp.now(),
        };

        // 1. Create the gift order with Giftbit
        const orderResponse = await createGiftbitGift(newGiftForApi);
        
        // 2. Extract the claim URL from the response
        const claimUrl = orderResponse?.direct_links?.[0];

        if (!claimUrl) {
            console.error('No claim URL found in Giftbit response for gift:', giftId, 'Response:', orderResponse);
            throw new Error(`Link generation failed for gift ${giftId}. No URL in response.`);
        }
        
        newGiftForApi.claimUrl = claimUrl;

        // 3. Update gift in Firestore, deduct balance, and create transaction atomically
        const newTransactionRef = adminDb.collection('transactions').doc();
        const newTransaction: Omit<Transaction, 'id'> = {
            userId: user.id,
            type: 'Deduction',
            amountInCents: amountInCents,
            description: `Gift to ${giftData.recipientName} (${giftData.recipientEmail})`,
            createdAt: Timestamp.now(),
            giftId: giftId,
            createdById: user.id,
        };
        
        await adminDb.runTransaction(async (transaction) => {
             transaction.update(userRef, {
                availableBalance: FieldValue.increment(-amountInCents)
            });
            transaction.set(giftRef, newGiftForApi);
            transaction.set(newTransactionRef, newTransaction);
        });

        // 4. Send email to recipient
        await sendGiftEmail({
            ...newGiftForApi,
            sender: user,
        });
        
        // 5. Check for low balance and send notification if needed
        const newBalance = (user.availableBalance || 0) - amountInCents;
        if (newBalance < LOW_BALANCE_THRESHOLD) {
            await sendLowBalanceEmail({ user: { ...user, id: userId }, currentBalanceInCents: newBalance });
        }
        
        return { success: true, message: "Gift sent successfully!" };

    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        // Attempt to mark as failed if it was partially processed
        const giftDoc = await giftRef.get();
        if (giftDoc.exists) {
            await giftRef.update({ status: 'Failed', claimUrl: null });
        }
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}
