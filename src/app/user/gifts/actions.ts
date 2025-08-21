
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { doc, runTransaction, Timestamp, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { adminDb, adminAuth } from '@/lib/firebase/server';
import { GiftbitBrand, createGift, listBrands } from '@/lib/giftbit';
import { UserProfile, Gift } from '@/lib/types';
import { cookies } from 'next/headers';


const sendGiftSchema = z.object({
  recipientName: z.string().min(2, "Please enter a name."),
  recipientEmail: z.string().email("Please enter a valid email address."),
  brandCode: z.string().min(1, "Please select a brand."),
  amountInCents: z.string().transform(val => {
    const numericVal = parseFloat(val.replace(/[^0-9.]/g, ''));
    return Math.round(numericVal * 100);
  }).pipe(z.number().min(500, "Amount must be at least $5.00.")),
});

export type SendGiftFormState = {
    success: boolean;
    message: string;
};

export async function getGiftbitBrands(): Promise<GiftbitBrand[]> {
    return await listBrands();
}

async function getCurrentUser(): Promise<(UserProfile & { uid: string }) | null> {
    const sessionCookie = cookies().get('AuthToken')?.value;
    if (!sessionCookie) {
        return null;
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists()) {
            return null;
        }
        return {
            uid: decodedToken.uid,
            ...userDoc.data(),
        } as UserProfile & { uid: string };
    } catch (error) {
        console.error("Error verifying session cookie:", error);
        return null;
    }
}


export async function sendGift(prevState: SendGiftFormState, formData: FormData): Promise<SendGiftFormState> {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return { success: false, message: 'You must be logged in to send a gift.' };
    }

    const validatedFields = sendGiftSchema.safeParse({
        recipientName: formData.get('recipientName'),
        recipientEmail: formData.get('recipientEmail'),
        brandCode: formData.get('brandCode'),
        amountInCents: formData.get('amountInCents'),
    });

    if (!validatedFields.success) {
        const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
        return {
            success: false,
            message: firstError || "Invalid data provided. Please check the form."
        };
    }
    
    const { recipientName, recipientEmail, brandCode, amountInCents } = validatedFields.data;

    try {
        const userDocRef = doc(adminDb, 'users', currentUser.uid);
        const giftId = uuidv4();
        
        const giftbitResponse = await runTransaction(adminDb, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User profile not found.");
            }
            const userProfile = userDoc.data() as UserProfile;
            const currentBalance = userProfile.availableBalance || 0;

            if (currentBalance < amountInCents) {
                throw new Error("Insufficient funds.");
            }

            const giftPayload = {
                brand_codes: [brandCode],
                price_in_cents: amountInCents,
                id: giftId,
                contacts: [{ name: recipientName, email: recipientEmail }],
            };
            const response = await createGift(giftPayload);
            
            const newBalance = currentBalance - amountInCents;
            transaction.update(userDocRef, { availableBalance: newBalance });

            const brandList = await getGiftbitBrands();
            const brandDetails = brandList.find(b => b.brand_code === brandCode);

            const giftDocRef = doc(adminDb, 'gifts', giftId);
            transaction.set(giftDocRef, {
                id: giftId,
                userId: currentUser.uid,
                recipientName,
                recipientEmail,
                brandCode,
                brandName: brandDetails?.name || brandCode,
                amountInCents,
                status: 'delivered',
                shortId: response.short_id,
                claimUrl: response.claim_url,
                createdAt: Timestamp.now(),
            });

            return response;
        });

        return { success: true, message: `Gift sent successfully! Claim URL: ${giftbitResponse.claim_url}` };

    } catch (error: any) {
        console.error('Error in sendGift transaction:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}


export async function getGiftLog(): Promise<Gift[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    try {
        const giftsQuery = query(
            collection(adminDb, "gifts"),
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const querySnapshot = await getDocs(giftsQuery);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                createdAt: data.createdAt.toDate().toISOString(),
            } as unknown as Gift;
        });
    } catch (error) {
        console.error("Error fetching gift log:", error);
        return [];
    }
}
