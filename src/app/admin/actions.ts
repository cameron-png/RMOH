
'use server';

import { adminDb } from '@/lib/firebase/server';
import { UserProfile, OpenHouse, FeedbackForm, AppSettings } from '@/lib/types';


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
