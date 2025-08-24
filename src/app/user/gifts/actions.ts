
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


async function createGiftbitGift(gift: Gift): Promise<{ claimUrl: string }> {
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

    const orderResponse = await response.json();
    const claimUrl = orderResponse?.direct_links?.[0];

    if (!claimUrl) {
        console.error('No claim URL found in Giftbit response for gift:', gift.id, 'Response:', orderResponse);
        throw new Error(`Link generation failed for gift ${gift.id}. No URL in response.`);
    }

    return { claimUrl };
}

interface SendManualGiftParams extends z.infer<typeof giftFormSchema> {
    userId: string;
}

export async function sendManualGift(params: SendManualGiftParams): Promise<{ success: boolean; giftId?: string; message?: string; }> {
    const { userId, ...giftData } = params;

    if (!userId) {
        return { success: false, message: "User not authenticated." };
    }
    
    const userRef = adminDb.collection('users').doc(userId);

    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User profile not found');
        const user = {id: userDoc.id, ...userDoc.data()} as UserProfile;

        const amountInCents = Math.round(parseFloat(giftData.amount) * 100);

        if (isNaN(amountInCents) || amountInCents <= 0) {
            return { success: false, message: "Invalid gift amount provided." };
        }

        if ((user.availableBalance || 0) < amountInCents) {
            return { success: false, message: 'Insufficient funds.' };
        }
        
        const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
        const settings = settingsDoc.data() as AppSettings;
        const enabledBrands = settings?.giftbit?.enabledBrands || [];
        const selectedBrandData = enabledBrands.find((b: GiftbitBrand) => b.brand_code === giftData.brandCode);
        
        const newGift: Omit<Gift, 'id'> = {
            userId: userId,
            recipientName: giftData.recipientName,
            recipientEmail: giftData.recipientEmail,
            brandCode: giftData.brandCode,
            brandName: selectedBrandData?.name || giftData.brandCode,
            amountInCents: amountInCents,
            message: giftData.message,
            type: 'Manual',
            status: 'Pending',
            claimUrl: null,
            createdAt: Timestamp.now(),
        };

        const giftRef = await adminDb.collection('gifts').add(newGift);
        
        return { success: true, giftId: giftRef.id, message: "Gift successfully queued." };

    } catch (error: any) {
        console.error(`Failed to create pending gift:`, error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function processGift(giftId: string): Promise<{ success: boolean; message?: string }> {
    const giftRef = adminDb.collection('gifts').doc(giftId);
    
    try {
        const giftDoc = await giftRef.get();
        if (!giftDoc.exists) throw new Error('Gift not found.');
        
        const gift = { id: giftDoc.id, ...giftDoc.data() } as Gift;
        const userRef = adminDb.collection('users').doc(gift.userId);

        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('Sender profile not found.');
        const user = { id: userDoc.id, ...userDoc.data() } as UserProfile;

        if ((user.availableBalance || 0) < gift.amountInCents) {
            await giftRef.update({ status: 'Failed' });
            return { success: false, message: 'Insufficient funds at time of processing.' };
        }

        // 1. Create the gift order with Giftbit
        const { claimUrl } = await createGiftbitGift(gift);
        
        // 2. Update gift in Firestore, deduct balance, and create transaction atomically
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
            transaction.update(userRef, { availableBalance: FieldValue.increment(-gift.amountInCents) });
            transaction.update(giftRef, { status: 'Sent', claimUrl: claimUrl });
            transaction.set(newTransactionRef, newTransaction);
        });

        // 3. Send email to recipient
        await sendGiftEmail({ ...gift, claimUrl, sender: user });
        
        // 4. Check for low balance and send notification if needed
        const newBalance = (user.availableBalance || 0) - gift.amountInCents;
        if (newBalance < LOW_BALANCE_THRESHOLD) {
            await sendLowBalanceEmail({ user: user, currentBalanceInCents: newBalance });
        }
        
        return { success: true, message: "Gift sent successfully!" };

    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        await giftRef.update({ status: 'Failed', claimUrl: null });
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}
