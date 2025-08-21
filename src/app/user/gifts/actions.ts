
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { sleep } from '@/lib/utils';


const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;
const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';


export async function getGiftbitBrands() {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }

    const response = await fetch(`${GIFTBIT_BASE_URL}/brands`, {
        headers: {
            'Authorization': `Bearer ${GIFTBIT_API_KEY}`,
        },
        // Use Next.js revalidation to cache for a day
        next: { revalidate: 86400 } 
    });

    if (!response.ok) {
        console.error(`Giftbit Brands API Error (${response.status}):`, await response.text());
        throw new Error('Failed to fetch brands from Giftbit.');
    }
    
    const data = await response.json();
    return data.brands || [];
}


async function createDirectLink(gift: Gift): Promise<any> {
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

async function getLink(giftId: string): Promise<any> {
    if (!GIFTBIT_API_KEY) throw new Error("GIFTBIT_API_KEY not configured.");

    const response = await fetch(`${GIFTBIT_BASE_URL}/links/${giftId}`, {
        headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to retrieve link for ${giftId}`);
    }
    
    return await response.json();
}


export async function processGift(giftId: string) {
    const giftRef = adminDb.collection('gifts').doc(giftId);

    try {
        const giftDoc = await giftRef.get();
        if (!giftDoc.exists) throw new Error('Gift not found');
        const gift = { id: giftDoc.id, ...giftDoc.data() } as Gift;

        const userRef = adminDb.collection('users').doc(gift.userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User not found');
        const user = userDoc.data() as UserProfile;

        // 1. Create the direct link order
        await createDirectLink(gift);

        // 2. Poll for the link to become available
        let linkData;
        for (let i = 0; i < 5; i++) { // Poll up to 5 times (10 seconds total)
            await sleep(2000); // Wait 2 seconds between polls
            linkData = await getLink(gift.id);
            if (linkData?.links?.[0]?.claim_link) {
                break;
            }
        }
        
        const claimUrl = linkData?.links?.[0]?.claim_link;

        if (!claimUrl) {
            throw new Error(`Link generation timed out for gift ${gift.id}`);
        }
        
        // 3. Update gift in Firestore
        await giftRef.update({
            status: 'Available',
            claimUrl: claimUrl,
        });

        // 4. Send email to recipient
        await sendGiftEmail({
            ...gift,
            claimUrl: claimUrl,
            sender: user,
        });

    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        await giftRef.update({ status: 'Failed' });
    }
}
