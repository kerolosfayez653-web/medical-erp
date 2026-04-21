import { NextRequest, NextResponse } from 'next/server';

const VALID_USERNAME = 'admin';
// نفس الـ token في الـ login API - يجب أن يكونا متطابقين
const SESSION_TOKEN = 'erp_secure_v1_24med_2026_a7b8c9d0e1f2';

function isValidSession(sessionCookie: string | undefined): boolean {
  if (!sessionCookie) return false;
  // الشكل: "username:token"
  const expected = `${VALID_USERNAME}:${SESSION_TOKEN}`;
  return sessionCookie === expected;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // صفحات عامة لا تحتاج تسجيل دخول
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.endsWith('/print') ||
    pathname.startsWith('/pay/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo');

  if (isPublic) return NextResponse.next();

  const sessionCookie = request.cookies.get('erp_session')?.value;

  if (!isValidSession(sessionCookie)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
