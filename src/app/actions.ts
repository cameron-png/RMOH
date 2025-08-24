
'use server';

import { adminDb } from '@/lib/firebase/server';
import { UserProfile, Lead, OpenHouse } from '@/lib/types';
import { _sendNewLeadEmail } from '@/lib/email';

interface SendNewLeadEmailParams {
    realtorId: string;
    leadId: string;
}

export async function sendNewLeadEmail({ realtorId, leadId }: SendNewLeadEmailParams) {
    try {
        const userDoc = await adminDb.collection('users').doc(realtorId).get();
        if (!userDoc.exists) throw new Error('Realtor profile not found.');
        const realtor = userDoc.data() as UserProfile;

        const leadDoc = await adminDb.collection('leads').doc(leadId).get();
        if (!leadDoc.exists) throw new Error('Lead data not found.');
        const lead = leadDoc.data() as Lead;
        
        let openHouseAddress = 'An Open House';
        if (lead.openHouseId) {
            const houseDoc = await adminDb.collection('openHouses').doc(lead.openHouseId).get();
            if (houseDoc.exists) {
                openHouseAddress = (houseDoc.data() as OpenHouse).address;
            }
        }

        await _sendNewLeadEmail({
            user: realtor,
            lead: lead,
            openHouseAddress: openHouseAddress,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error in sendNewLeadEmail server action:', error);
        // We don't want to throw an error back to the client here,
        // as this is a background task. We just log it.
        return { success: false, error: error.message };
    }
}
