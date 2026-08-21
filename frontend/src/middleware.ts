import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const PROTECTED = ['/dashboard', '/items/new', '/profile', '/requests', '/groups', '/notifications', '/activities']

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale = isEn ? 'en' : 'pt'
  const pathWithoutLocale = isEn ? pathname.slice(3) || '/' : pathname

  const isProtected =
    PROTECTED.some((p) => pathWithoutLocale.startsWith(p)) ||
    /^\/items\/.+\/edit$/.test(pathWithoutLocale)

  if (isProtected && !request.cookies.get('lendly_token')?.value) {
    const url = new URL(locale === 'en' ? '/en/login' : '/login', request.url)
    // Always delocalized — @/i18n/navigation's router.push re-prefixes on
    // its own, so a prefixed value here would double up to /en/en/...
    url.searchParams.set('redirect', pathWithoutLocale)
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  // Excludes anything with a file extension (robots.txt, sitemap.xml, and
  // any static asset under public/ — og-image.jpg, team-photo.jpg, future
  // additions) in addition to the framework's own internals. Pages never
  // have a dot in their path, so this is safe for real routes.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
