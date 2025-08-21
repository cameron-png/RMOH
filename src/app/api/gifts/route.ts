'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/server';
import { Gift } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { recipientName, recipientEmail, brandCode, amountInCents } = body;

    if (!recipientName || !recipientEmail || !brandCode || typeof amountInCents !== 'number') {
        return NextResponse.json({ message: 'Missing required gift information.' }, { status: 400 });
    }

    const giftsCollectionRef = adminDb.collection("gifts");

    const newGift: Omit<Gift, 'id'> = {
        userId,
        recipientName,
        recipientEmail,
        brandCode,
        amountInCents,
        type: 'Manual',
        status: 'Pending',
        claimUrl: null, 
        createdAt: Timestamp.now(),
    };

    await giftsCollectionRef.add(newGift);

    return NextResponse.json({ success: true, message: 'Gift created successfully.' }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating gift in API route: ", error);

    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/invalid-session-cookie') {
        return NextResponse.json({ message: 'Session expired. Please log in again.' }, { status: 401 });
    }

    return NextResponse.json({ message: 'Failed to create gift.' }, { status: 500 });
  }
}
