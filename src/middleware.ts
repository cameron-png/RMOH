import type { NextRequest } from 'next/server';
import { authMiddleware } from 'next-firebase-auth-edge';
import { NextResponse } from 'next/server';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL!;
// The private key is not a single-line value, so we need to process it
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

export async function middleware(request: NextRequest) {
  // If the private key is not available, we can't do server-side auth
  // and we'll just have to let the request through and rely on client-side checks
  if (!FIREBASE_PRIVATE_KEY) {
    return NextResponse.next();
  }

  return authMiddleware(request, {
    loginPath: '/api/auth/login',
    logoutPath: '/api/auth/logout',
    apiKey: FIREBASE_API_KEY,
    cookieName: '__session',
    cookieSignatureKeys: [
      'secret1',
      'secret2',
    ],
    cookieSerializeOptions: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 24, // 12 days
    },
    serviceAccount: {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    },
    handleInvalidToken: async () => {
      return NextResponse.redirect(new URL('/', request.url));
    },
    handleError: async (error) => {
      console.error('Auth Middleware Error:', error.message);
      // Fallback to redirecting to login page
      return NextResponse.redirect(new URL('/', request.url));
    },
  });
}

export const config = {
  matcher: ['/user/:path*', '/admin/:path*'],
};
