
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile, GiftbitBrand, GiftbitRegion, AppSettings } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { sleep } from '@/lib/utils';


const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;
const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';

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

    const response = await fetch(`${GIFTBIT_BASE_URL}/brands?region_code=${regionCode}`, {
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
    const allBrands = data.brands || [];

    // If no brands are configured in settings, allow all for that region. Otherwise, filter.
    if (!enabledBrandCodes || enabledBrandCodes.length === 0) {
        return allBrands;
    }

    return allBrands.filter((brand: GiftbitBrand) => enabledBrandCodes.includes(brand.brand_code));
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
