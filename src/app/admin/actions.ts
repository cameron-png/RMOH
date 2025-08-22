
'use server';

import { adminDb } from '@/lib/firebase/server';
import { UserProfile, OpenHouse, FeedbackForm, AppSettings, GiftbitRegion, GiftbitBrand, GiftbitSettings, Gift, AdminGift } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';


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


export async function getAdminDashboardData() {
    try {
        const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Fetch all collections in parallel
        const [usersSnapshot, housesSnapshot, formsSnapshot, settingsDoc, giftsSnapshot] = await Promise.all([
            adminDb.collection('users').get(),
            adminDb.collection('openHouses').get(),
            adminDb.collection('feedbackForms').where('type', '==', 'global').get(),
            adminDb.collection('settings').doc('appDefaults').get(),
            adminDb.collection('gifts').get()
        ]);

        // Process Users
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserProfile);
        const newUsers7Days = users.filter(u => u.createdAt && u.createdAt >= sevenDaysAgo).length;

        // Process Open Houses
        const openHouses = housesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OpenHouse);
        const newOpenHouses7Days = openHouses.filter(h => h.createdAt && h.createdAt >= sevenDaysAgo).length;
        
        // Process Gifts
        const gifts = giftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as Gift));
        const newGifts7Days = gifts.filter(g => g.createdAt && g.createdAt >= sevenDaysAgo).length;


        // Process Forms
        const forms = formsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as FeedbackForm);
        
        // Process Settings
        const settings = settingsDoc.exists ? settingsDoc.data() as AppSettings : {};
        
        return {
            stats: {
                totalUsers: users.length,
                newUsers7Days,
                totalOpenHouses: openHouses.length,
                newOpenHouses7Days,
                totalGifts: gifts.length,
                newGifts7Days,
            },
            users: serializeTimestamps(users),
            openHouses: serializeTimestamps(openHouses),
            forms: serializeTimestamps(forms),
            settings: serializeTimestamps(settings),
        };
    } catch (error: any) {
        // Gracefully handle cases where collections might not exist yet
        if (error.code === 'NOT_FOUND' || (error.details && error.details.includes('NOT_FOUND'))) {
             console.log("A required collection was not found, returning default empty/zero values.");
             return {
                stats: { totalUsers: 0, newUsers7Days: 0, totalOpenHouses: 0, newOpenHouses7Days: 0, totalGifts: 0, newGifts7Days: 0 },
                users: [], openHouses: [], forms: [], settings: {}
             }
        }
        console.error("Error in getAdminDashboardData:", error);
        throw new Error("Failed to fetch admin dashboard data: " + error.message);
    }
}


const GIFTBIT_API_KEY = process.env.GIFTBIT_API_KEY;
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
            console.error('Giftbit API Error:', {
                brandsStatus: brandsResponse.status,
            });
            throw new Error('Failed to fetch data from Giftbit.');
        }

        const brandsData = await brandsResponse.json();

        // Filter for brands available in the US
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
