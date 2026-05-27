import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/', '/_next', '/api/health', '/favicon.ico']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/api/v1/dashboard/health')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get('nobleport_session')?.value;
  const apiKey = request.headers.get('x-api-key');

  if (pathname.startsWith('/admin/') || pathname.startsWith('/dashboard/')) {
    if (!authToken && !apiKey) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();

  response.headers.set('X-NoblePort-Region', process.env.VERCEL_REGION || 'local');
  response.headers.set('X-NoblePort-Edge', '1');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
