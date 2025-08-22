
'use server';

import { adminDb } from '@/lib/firebase/server';
import { UserProfile, OpenHouse, FeedbackForm, AppSettings, GiftbitRegion, GiftbitBrand, GiftbitSettings } from '@/lib/types';


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
        let users: UserProfile[] = [];
        try {
            const usersSnapshot = await adminDb.collection('users').get();
            users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserProfile);
        } catch (error: any) {
            if (error.code === 'NOT_FOUND' || (error.details && error.details.includes('NOT_FOUND'))) {
                console.log("Admin Dashboard: 'users' collection not found, returning empty array.");
            } else {
                throw error; // Re-throw other errors
            }
        }

        let openHouses: OpenHouse[] = [];
        try {
            const housesSnapshot = await adminDb.collection('openHouses').get();
            openHouses = housesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OpenHouse);
        } catch (error: any) {
            if (error.code === 'NOT_FOUND' || (error.details && error.details.includes('NOT_FOUND'))) {
                console.log("Admin Dashboard: 'openHouses' collection not found, returning empty array.");
            } else {
                throw error;
            }
        }

        let forms: FeedbackForm[] = [];
        try {
            const formsSnapshot = await adminDb.collection('feedbackForms').where('type', '==', 'global').get();
            forms = formsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as FeedbackForm);
        } catch (error: any) {
            if (error.code === 'NOT_FOUND' || (error.details && error.details.includes('NOT_FOUND'))) {
                console.log("Admin Dashboard: 'feedbackForms' collection not found, returning empty array.");
            } else {
                throw error;
            }
        }
        
        let settings: AppSettings = {};
        try {
            const settingsDoc = await adminDb.collection('settings').doc('appDefaults').get();
            if (settingsDoc.exists) {
                settings = settingsDoc.data() as AppSettings;
            }
        } catch (error: any) {
             if (error.code === 'NOT_FOUND' || (error.details && error.details.includes('NOT_FOUND'))) {
                console.log("Admin Dashboard: 'settings' collection not found, returning empty object.");
            } else {
                throw error;
            }
        }
        
        return {
            users: serializeTimestamps(users),
            openHouses: serializeTimestamps(openHouses),
            forms: serializeTimestamps(forms),
            settings: serializeTimestamps(settings),
        };
    } catch (error: any) {
        console.error("Error in getAdminDashboardData:", error);
        throw new Error("Failed to fetch admin dashboard data: " + error.message);
    }
}


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


export async function getAvailableGiftbitRegionsAndBrands(): Promise<{ regions: GiftbitRegion[], brands: GiftbitBrand[] }> {
    if (!GIFTBIT_API_KEY) {
        throw new Error('GIFTBIT_API_KEY is not configured on the server.');
    }

    try {
        const [regionsResponse, brandsResponse] = await Promise.all([
            fetch(`${GIFTBIT_BASE_URL}/regions`, {
                headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
                next: { revalidate: 86400 } // Revalidate once a day
            }),
            fetch(`${GIFTBIT_BASE_URL}/brands?limit=500`, { // Fetch all brands
                headers: { 'Authorization': `Bearer ${GIFTBIT_API_KEY}` },
                next: { revalidate: 3600 } // Revalidate every hour
            })
        ]);

        if (!regionsResponse.ok || !brandsResponse.ok) {
            console.error('Giftbit API Error:', {
                regionsStatus: regionsResponse.status,
                brandsStatus: brandsResponse.status,
            });
            throw new Error('Failed to fetch data from Giftbit.');
        }

        const regionsData = await regionsResponse.json();
        const brandsData = await brandsResponse.json();

        const processedRegions = (regionsData.regions || []).map((region: any) => {
            const code = getRegionCodeFromName(region.name);
            return {
                ...region,
                code: code,
                currency: regionCurrencyMap[code] || 'USD'
            };
        });
        
        const processedBrands = (brandsData.brands || []).map((brand: any) => ({
            ...brand,
            // The brand endpoint doesn't give us region codes, so we add a placeholder.
            // The frontend will do the actual filtering based on the user's region.
            region_codes: brand.region_codes || [] 
        }));

        return {
            regions: processedRegions,
            brands: processedBrands,
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
