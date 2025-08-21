
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const idToken = authorization.split('Bearer ')[1];
    // Set session cookie with the standard name `__session`
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    cookies().set('__session', idToken, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
    });
    return NextResponse.json({ status: 'success' });
  }
  return new Response('Unauthorized', { status: 401 });
}
