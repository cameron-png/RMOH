
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    cookies().delete('AuthToken');
    return NextResponse.json({ status: 'success' });
}
