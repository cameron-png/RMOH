
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    cookies().delete('__session');
    return NextResponse.json({ status: 'success' });
}
