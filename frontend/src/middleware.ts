import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/items/new', '/profile']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('lendly_token')?.value
  const { pathname } = request.nextUrl

  const isProtected =
    PROTECTED.some((p) => pathname.startsWith(p)) || /^\/items\/.+\/edit$/.test(pathname)

  if (isProtected && !token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
