
'use server';

import { adminDb } from '@/lib/firebase/server';
import { UserProfile, OpenHouse, FeedbackForm, AppSettings, GiftbitBrand, GiftbitSettings, Gift, AdminGift } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;

function serializeTimestamps(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeTimestamps);
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            newObj[key] = serializeTimestamps(obj[key]);
        }
        return newObj;
    }
    return obj;
}

// NOTE: getAdminDashboardData has been removed and fetching is now done client-side on the admin page.

const GIFTBIT_BASE_URL = 'https://api-testbed.giftbit.com/papi/v1';


export async function getAvailableGiftbitBrands(): Promise<{ brands: GiftbitBrand[] }> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }

    try {
        const brandsResponse = await fetch(`${GIFTBIT_BASE_URL}/brands?limit=500`, {
            headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
            next: { revalidate: 3600 } // Revalidate every hour
        });

        if (!brandsResponse.ok) {
            console.error('Giftbit API Error fetching brands:', {
                status: brandsResponse.status,
                body: await brandsResponse.text()
            });
            throw new Error('Failed to fetch brand data from Giftbit.');
        }

        const brandsData = await brandsResponse.json();
        
        const usBrands = (brandsData.brands || []).filter((brand: any) => 
            brand.region_codes.includes("us")
        );
        
        return {
            brands: usBrands,
        };
    } catch (error: any) {
        console.error('Error fetching from Giftbit:', error.message);
        throw new Error('Could not retrieve Giftbit data.');
    }
}

export async function saveGiftbitSettings(settings: GiftbitSettings): Promise<{ success: boolean; message?: string }> {
    try {
        const settingsDocRef = adminDb.collection('settings').doc('appDefaults');
        await settingsDocRef.set({ giftbit: settings }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving Giftbit settings:", error);
        return { success: false, message: 'Failed to save settings.' };
    }
}


export async function getAdminGiftData(): Promise<AdminGift[]> {
    if (!GIFTBIT_API_KEY) {
        console.log('GIFTBIT_API_KEY is not configured on the server. Skipping Giftbit API call.');
    }

    try {
        const [giftsSnapshot, usersSnapshot, giftbitRewardsResponse, allBrandsResponse] = await Promise.all([
            adminDb.collection('gifts').orderBy('createdAt', 'desc').get(),
            adminDb.collection('users').get(),
            GIFTBIT_API_KEY ? fetch(`${GIFTBIT_BASE_URL}/gifts?limit=500`, { 
                headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
                next: { revalidate: 60 } 
            }) : Promise.resolve(null),
            GIFTBIT_API_KEY ? getAvailableGiftbitBrands() : Promise.resolve({ brands: [] }),
        ]);

        const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data() as UserProfile]));
        const giftsFromDb = giftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gift));
        const allBrandsMap = new Map((allBrandsResponse.brands || []).map(b => [b.brand_code, b.name]));
        
        let giftbitRewardsMap = new Map();
        if (giftbitRewardsResponse && giftbitRewardsResponse.ok) {
            const giftbitData = await giftbitRewardsResponse.json();
            (giftbitData.gifts || []).forEach((reward: any) => {
                giftbitRewardsMap.set(reward.uuid, reward);
            });
        } else if (giftbitRewardsResponse) {
             console.error('Giftbit API Error:', {
                status: giftbitRewardsResponse.status,
                body: await giftbitRewardsResponse.text(),
            });
        }
        
        const combinedGifts = giftsFromDb.map(gift => {
            const sender = usersMap.get(gift.userId);
            const giftbitReward = giftbitRewardsMap.get(gift.id);

            return {
                ...gift,
                senderName: sender?.name || 'Unknown User',
                senderEmail: sender?.email || 'N/A',
                brandName: allBrandsMap.get(gift.brandCode) || gift.brandCode,
                giftbitStatus: giftbitReward?.status,
                giftbitRedeemedDate: giftbitReward?.redeemed_date,
            };
        });

        return serializeTimestamps(combinedGifts) as AdminGift[];

    } catch (error: any) {
        console.error("Error in getAdminGiftData:", error);
        throw new Error("Failed to fetch admin gift data: " + error.message);
    }
}


export async function cancelGiftbitReward(giftId: string): Promise<{ success: boolean; message: string }> {
    if (!GIFTBIT_API_KEY) {
        return { success: false, message: 'GIFTBIT_API_KEY is not configured on the server.' };
    }

    try {
        const response = await fetch(`${GIFTBIT_BASE_URL}/gifts/${giftId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
        });

        if (response.ok) {
            // Update the status in our Firestore database
            const giftRef = adminDb.collection('gifts').doc(giftId);
            await giftRef.update({ status: 'Cancelled' });
            return { success: true, message: 'Gift successfully cancelled.' };
        } else {
            const errorBody = await response.json();
            const errorMessage = errorBody.errors?.[0]?.message || 'Failed to cancel gift.';
            console.error('Giftbit Cancel API Error:', errorBody);
            return { success: false, message: errorMessage };
        }
    } catch (error: any) {
        console.error('Error cancelling Giftbit reward:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function getGiftbitBalance(): Promise<number | null> {
    if (!GIFTBIT_API_KEY) {
        console.log('GIFTBIT_API_KEY is not configured on the server.');
        return null;
    }

    try {
        const response = await fetch(`${GIFTBIT_BASE_URL}/funds`, {
            headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
            next: { revalidate: 300 } // Revalidate every 5 minutes
        });

        if (!response.ok) {
            console.error('Giftbit Funds API Error:', {
                status: response.status,
                body: await response.text(),
            });
            throw new Error('Failed to fetch balance from Giftbit.');
        }

        const data = await response.json();
        return data.balance_in_cents;

    } catch (error: any) {
        console.error('Error fetching Giftbit balance:', error.message);
        return null; // Return null on error so the UI can handle it gracefully
    }
}


export async function resetApplicationSettings(): Promise<{ success: boolean; message: string }> {
  try {
    const settingsDocRef = adminDb.collection('settings').doc('appDefaults');
    const settingsDoc = await settingsDocRef.get();

    if (!settingsDoc.exists) {
      // If the document doesn't exist, we can just create a clean one.
      await settingsDocRef.set({});
      return { success: true, message: 'Settings document was not found and has been initialized.' };
    }

    const currentSettings = settingsDoc.data() as AppSettings;

    // Create a new object with only the allowed, current fields.
    const cleanSettings: AppSettings = {};
    
    // Explicitly carry over only the fields we know are current.
    if (currentSettings.defaultGlobalFormId) {
        cleanSettings.defaultGlobalFormId = currentSettings.defaultGlobalFormId;
    }
    if (currentSettings.giftbit) {
        cleanSettings.giftbit = {
            enabledBrandCodes: currentSettings.giftbit.enabledBrandCodes || [],
        };
    }
    
    // Overwrite the document with the cleaned settings object.
    // This removes any old fields that are not in cleanSettings.
    await settingsDocRef.set(cleanSettings);

    return { success: true, message: 'Legacy settings have been cleared.' };
  } catch (error: any) {
    console.error('Error resetting application settings:', error);
    return { success: false, message: 'An unexpected error occurred during the settings reset.' };
  }
}

    