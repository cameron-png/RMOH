
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createGiftbitLink, getGiftbitLink } from '@/lib/giftbit';
import type { Gift } from '@/lib/types';
import { sleep } from '@/lib/utils';

const createGiftSchema = z.object({
  brandCode: z.string().min(1, "Please select a brand."),
  amountInCents: z.string().transform(val => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal)) return 0;
    return Math.round(numericVal * 100);
  }).pipe(z.number().min(500, "Amount must be at least $5.00.")),
});

export type CreateGiftFormState = {
    success: boolean;
    message: string;
    gift?: Gift;
};

export async function createGiftLink(prevState: CreateGiftFormState, formData: FormData): Promise<CreateGiftFormState> {
    const validatedFields = createGiftSchema.safeParse({
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
    
    const { brandCode, amountInCents } = validatedFields.data;
    const giftId = uuidv4();

    try {
        // Step 1: POST to create the gift order with our unique ID.
        await createGiftbitLink({
            brand_codes: [brandCode],
            price_in_cents: amountInCents,
            id: giftId,
        });

        // Step 2: Wait for a moment for Giftbit to process.
        await sleep(2000); // 2-second delay

        // Step 3: GET the generated link details using the same ID.
        const giftbitResponse = await getGiftbitLink(giftId);

        // The GET /links/{id} response contains an array of links. We want the first one.
        const linkDetails = giftbitResponse?.links?.[0];

        if (!linkDetails || !linkDetails.short_id || !linkDetails.claim_url) {
             console.error('Invalid Giftbit GET response structure:', giftbitResponse);
             throw new Error("Could not retrieve the generated gift link from Giftbit.");
        }
        
        const createdGift: Gift = {
            id: giftId,
            userId: '', // This is a transient gift, not saved to DB
            brandCode: brandCode,
            brandName: linkDetails.brands?.[0]?.name || brandCode,
            amountInCents,
            status: 'created',
            shortId: linkDetails.short_id,
            claimUrl: linkDetails.claim_url,
            createdAt: new Date(), 
        };
        
        return { 
            success: true, 
            message: 'Gift link created successfully!',
            gift: createdGift
        };

    } catch (error: any) {
        console.error('Error in two-step gift creation process:', error);
        return { success: false, message: error.message || 'An unexpected error occurred while creating the gift.' };
    }
}
