
'use server';

import { adminDb } from '@/lib/firebase/server';
import { Transaction } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

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

export async function getBillingHistory(): Promise<{ transactions: Transaction[] }> {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
        throw new Error("User not authenticated");
    }

    try {
        const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;

        const transactionsQuery = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const transactions = transactionsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
        
        return {
            transactions: serializeTimestamps(transactions) as Transaction[],
        };
    } catch (error: any) {
        console.error("Error fetching billing history:", error);
        throw new Error("Failed to fetch billing history: " + error.message);
    }
}
