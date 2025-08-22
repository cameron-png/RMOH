
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile, GiftbitBrand, GiftbitRegion, AppSettings } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { sleep } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';


const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;
const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';
const LOW_BALANCE_THRESHOLD = 2500; // $25 in cents

const regionCurrencyMap: { [key: string]: string } = {
    'ca': 'CAD',
    'us': 'USD',
    'au': 'AUD',
    'global': 'USD'
};

function getRegionCodeFromName(name: string): string {
    if (name === "USA") return "us";
    if (name === "Canada") return "ca";
    if (name === "Australia") return "au";
    return name.toLowerCase();
}


export async function getGiftbitRegions(): Promise<GiftbitRegion[]> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }
    
    // First, get enabled regions from settings
    const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
    const settings = settingsDoc.data() as AppSettings;
    const enabledRegionCodes = settings?.giftbit?.enabledRegionCodes;

    const response = await fetch(`${GIFTBIT_BASE_URL}/regions`, {
        headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
        next: { revalidate: 86400 } // Revalidate once a day
    });

    if (!response.ok) {
        console.error(`Giftbit Regions API Error (${response.status}):`, await response.text());
        throw new Error('Failed to fetch regions from Giftbit.');
    }
    const data = await response.json();
    const allRegions: GiftbitRegion[] = (data.regions || []).map((region: any) => {
        const code = getRegionCodeFromName(region.name);
        return {
            ...region,
            code: code,
            currency: regionCurrencyMap[code] || 'USD'
        };
    });
    
    // If no regions are configured in settings, allow all. Otherwise, filter.
    if (!enabledRegionCodes || enabledRegionCodes.length === 0) {
        return allRegions;
    }
    
    return allRegions.filter((region: GiftbitRegion) => enabledRegionCodes.includes(region.code));
}

export async function getGiftbitBrands(regionCode: string): Promise<GiftbitBrand[]> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }
    
     // First, get enabled brands from settings
    const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
    const settings = settingsDoc.data() as AppSettings;
    const enabledBrandCodes = settings?.giftbit?.enabledBrandCodes;

    // Fetch all brands for the specified region
    const response = await fetch(`${GIFTBIT_BASE_URL}/brands?limit=500&region_code=${regionCode}`, {
        headers: {
            'Authorization': `Bearer ${GIFTBIT_API_KEY}`,
        },
        next: { revalidate: 3600 } // Revalidate every hour
    });

    if (!response.ok) {
        console.error(`Giftbit Brands API Error (${response.status}):`, await response.text());
        throw new Error('Failed to fetch brands from Giftbit.');
    }
    
    const data = await response.json();
    const allBrandsForRegion = data.brands || [];

    // If no brands are configured in settings, allow all for that region. Otherwise, filter.
    if (!enabledBrandCodes || enabledBrandCodes.length === 0) {
        return allBrandsForRegion;
    }

    return allBrandsForRegion.filter((brand: GiftbitBrand) => enabledBrandCodes.includes(brand.brand_code));
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
        
        // Check balance again on the server side for security
        if ((user.availableBalance || 0) < gift.amountInCents) {
            throw new Error('Insufficient funds.');
        }

        // 1. Create the direct link order
        const orderResponse = await createDirectLink(gift);
        
        // 2. Extract the claim URL from the response
        const claimUrl = orderResponse?.direct_links?.[0];

        if (!claimUrl) {
            console.error('No claim URL found in Giftbit response for gift:', gift.id, 'Response:', orderResponse);
            throw new Error(`Link generation failed for gift ${gift.id}. No URL in response.`);
        }
        
        // 3. Update gift in Firestore and deduct balance atomically
        await adminDb.runTransaction(async (transaction) => {
             transaction.update(userRef, {
                availableBalance: FieldValue.increment(-gift.amountInCents)
            });
            transaction.update(giftRef, {
                status: 'Sent',
                claimUrl: claimUrl,
            });
        });


        // 4. Send email to recipient
        await sendGiftEmail({
            ...gift,
            claimUrl: claimUrl,
            sender: user,
        });
        
        // 5. Check for low balance and send notification if needed
        const newBalance = (user.availableBalance || 0) - gift.amountInCents;
        if (newBalance < LOW_BALANCE_THRESHOLD) {
            await sendLowBalanceEmail({ user: user, currentBalanceInCents: newBalance });
        }


    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        await giftRef.update({ status: 'Failed' });
    }
}
