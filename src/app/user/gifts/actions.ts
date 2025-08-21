
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { doc, runTransaction, Timestamp, collection, getDocs, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase/server';
import { GiftbitBrand, createGift as createGiftbitLink, listBrands } from '@/lib/giftbit';
import { UserProfile, Gift } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const createGiftSchema = z.object({
  brandCode: z.string().min(1, "Please select a brand."),
  amountInCents: z.string().transform(val => {
    const numericVal = parseFloat(val.replace(/[^0-9.]/g, ''));
    return Math.round(numericVal * 100);
  }).pipe(z.number().min(500, "Amount must be at least $5.00.")),
  userId: z.string().min(1, "User ID is required."),
});

const sendEmailSchema = z.object({
  giftId: z.string().min(1),
  recipientName: z.string().min(2, "Please enter a name."),
  recipientEmail: z.string().email("Please enter a valid email address."),
});


export type CreateGiftFormState = {
    success: boolean;
    message: string;
    gift?: Gift;
};

export async function getGiftbitBrands(): Promise<GiftbitBrand[]> {
    return await listBrands();
}


export async function createGiftLink(prevState: CreateGiftFormState, formData: FormData): Promise<CreateGiftFormState> {
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
    const giftId = uuidv4();

    try {
        const userDocRef = doc(adminDb, 'users', userId);
        
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
            };
            const response = await createGiftbitLink(giftPayload);
            
            const newBalance = currentBalance - amountInCents;
            transaction.update(userDocRef, { availableBalance: newBalance });

            const brandList = await getGiftbitBrands();
            const brandDetails = brandList.find(b => b.brand_code === brandCode);

            const newGift: Gift = {
                id: giftId,
                userId: userId,
                brandCode,
                brandName: brandDetails?.name || brandCode,
                amountInCents,
                status: 'created',
                shortId: response.short_id,
                claimUrl: response.claim_url,
                createdAt: Timestamp.now(),
            };

            const giftDocRef = doc(adminDb, 'gifts', giftId);
            transaction.set(giftDocRef, newGift);

            return { giftbitResponse: response, createdGift: newGift };
        });
        
        revalidatePath('/user/gifts');
        revalidatePath('/user/billing');

        return { 
            success: true, 
            message: `Gift link created successfully!`,
            gift: {
                ...giftbitResponse.createdGift,
                createdAt: giftbitResponse.createdGift.createdAt.toDate().toISOString(),
            } as unknown as Gift
        };

    } catch (error: any) {
        console.error('Error in createGiftLink transaction:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}


export async function getGiftLog(userId: string): Promise<Gift[]> {
    if (!userId) return [];

    try {
        const giftsQuery = query(
            collection(adminDb, "gifts"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(50)
        );
        const querySnapshot = await getDocs(giftsQuery);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                createdAt: data.createdAt.toDate().toISOString(),
                sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : undefined,
            } as unknown as Gift;
        });
    } catch (error) {
        console.error("Error fetching gift log:", error);
        return [];
    }
}

// A new function to send the email will be added here later.
// For now, we will just update the gift status.
export async function sendGiftByEmail(prevState: any, formData: FormData): Promise<{success: boolean; message: string;}> {
     const validatedFields = sendEmailSchema.safeParse({
        giftId: formData.get('giftId'),
        recipientName: formData.get('recipientName'),
        recipientEmail: formData.get('recipientEmail'),
    });

    if (!validatedFields.success) {
        return { success: false, message: "Invalid data." };
    }

    const { giftId, recipientName, recipientEmail } = validatedFields.data;

    try {
        const giftDocRef = doc(adminDb, 'gifts', giftId);
        await updateDoc(giftDocRef, {
            recipientName,
            recipientEmail,
            status: 'sent',
            sentAt: Timestamp.now(),
        });
        
        revalidatePath('/user/gifts');
        return { success: true, message: 'Gift marked as sent.' };
    } catch (error) {
        console.error("Error marking gift as sent:", error);
        return { success: false, message: 'Could not update the gift status.'};
    }
}
