
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Gift, UserProfile, GiftbitBrand, AppSettings, OpenHouse, Transaction } from '@/lib/types';
import { sendGiftEmail, sendLowBalanceEmail } from '@/lib/email';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();
const GIFTBIT_API_KEY = serverRuntimeConfig.giftbitApiKey;

const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';
const LOW_BALANCE_THRESHOLD = 2500; // $25 in cents


export async function getGiftConfigurationForUser(): Promise<{ brands: GiftbitBrand[] }> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }
    
    try {
        // First, get enabled brands from app settings using the Admin SDK
        const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
        const settings = settingsDoc.data() as AppSettings;
        const enabledBrandCodes = settings?.giftbit?.enabledBrandCodes;

        // Fetch all brands from the Giftbit API
        const brandsResponse = await fetch(`${GIFTBIT_BASE_URL}/brands?limit=500`, {
            headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
            next: { revalidate: 3600 } // Revalidate every hour
        });

        if (!brandsResponse.ok) {
            console.error(`Giftbit API Error (Brands: ${brandsResponse.status})`);
            throw new Error('Failed to fetch data from Giftbit.');
        }
        
        const brandsData = await brandsResponse.json();
        const allBrands: GiftbitBrand[] = brandsData.brands || [];
        
        // Filter for US brands
        const usBrands = allBrands.filter(brand => brand.region_codes.includes('us'));

        // If no brands are configured in settings (e.g. admin hasn't set any), allow all for that region.
        if (!enabledBrandCodes || enabledBrandCodes.length === 0) {
            return { brands: usBrands };
        }

        // Otherwise, filter the brands from the API based on the admin's enabled list.
        const enabledBrands = usBrands.filter((brand) => 
            enabledBrandCodes.includes(brand.brand_code)
        );
        
        return { brands: enabledBrands };
    } catch (error: any) {
        console.error("Error fetching gift configuration for user:", error.message);
        throw new Error("Could not load gift card information.");
    }
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
        
        let openHouseAddress: string | undefined = undefined;
        if (gift.openHouseId) {
            const houseDoc = await adminDb.collection('openHouses').doc(gift.openHouseId).get();
            if (houseDoc.exists) {
                openHouseAddress = (houseDoc.data() as OpenHouse).address;
            }
        }

        // Fetch brand details to get the brand name
        const brandResponse = await fetch(`${GIFTBIT_BASE_URL}/brands/${gift.brandCode}`, {
            headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` }
        });
        if (!brandResponse.ok) throw new Error(`Could not fetch brand details for ${gift.brandCode}`);
        const brandData = await brandResponse.json();
        const brandName = brandData.brand.name;


        // 1. Create the direct link order
        const orderResponse = await createDirectLink(gift);
        
        // 2. Extract the claim URL from the response
        const claimUrl = orderResponse?.direct_links?.[0];

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
            await sendLowBalanceEmail({ user: user, currentBalanceInCents: newBalance });
        }


    } catch (error: any) {
        console.error(`Failed to process gift ${giftId}:`, error);
        await giftRef.update({ status: 'Failed' });
    }
}


export async function confirmPendingGift(giftId: string): Promise<{ success: boolean, message?: string }> {
  try {
    // We don't need to check balance here, `processGift` does it securely.
    await processGift(giftId);
    return { success: true };
  } catch (error: any) {
    console.error(`Error confirming gift ${giftId}:`, error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function declinePendingGift(giftId: string): Promise<{ success: boolean, message?: string }> {
  try {
    const giftRef = adminDb.collection('gifts').doc(giftId);
    await giftRef.update({ status: 'Cancelled' });
    return { success: true };
  } catch (error: any) {
    console.error(`Error declining gift ${giftId}:`, error);
    return { success: false, message: 'Failed to decline the gift.' };
  }
}
