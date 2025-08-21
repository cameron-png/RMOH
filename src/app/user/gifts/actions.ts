
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createGift as createGiftbitLink } from '@/lib/giftbit';
import { Gift, GiftbitBrand } from '@/lib/types';

const createGiftSchema = z.object({
  brandCode: z.string().min(1, "Please select a brand."),
  amountInCents: z.string().transform(val => {
    const numericVal = parseFloat(val.replace(/[^0-9.]/g, ''));
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
        const giftPayload = {
            brand_codes: [brandCode],
            price_in_cents: amountInCents,
            id: giftId,
        };

        const giftbitResponse = await createGiftbitLink(giftPayload);
        
        const createdGift: Gift = {
            id: giftId,
            userId: '', // This is a transient gift, not yet saved to DB for a user
            brandCode: brandCode,
            amountInCents,
            status: 'created',
            shortId: giftbitResponse.short_id,
            claimUrl: giftbitResponse.claim_url,
            createdAt: new Date(), 
        };
        
        return { 
            success: true, 
            message: `Gift link created successfully!`,
            gift: createdGift
        };

    } catch (error: any) {
        console.error('Error creating Giftbit link:', error);
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}
