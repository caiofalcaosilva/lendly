import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import '../globals.css'
import { routing } from '@/i18n/routing'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { ToastProvider } from '@/contexts/ToastContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })
// Numbers only (price, date, phone, counts) — see design_system.md.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: { pt: '/', en: '/en' },
    },
    // Site-wide fallback — item/user pages override this with the item's
    // own photo/avatar via their own generateMetadata when one exists.
    // /public/og-image.jpg is a placeholder; swap the file for real 1200×630
    // art whenever it's ready, no code change needed.
    openGraph: {
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/og-image.jpg'],
    },
  }
}

// Runs before hydration so the correct theme class is set before first paint —
// avoids a light-mode flash for users who prefer dark.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Blank until a measurement ID exists (see NEXT_PUBLIC_GA_MEASUREMENT_ID
// in .env) — same "inert until configured" pattern as every other
// external integration in this codebase. No script loads at all without it.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()
  const t = await getTranslations({ locale, namespace: 'Common.SkipLink' })

  return (
    <html lang={locale === 'en' ? 'en' : 'pt-BR'}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body className={`${inter.className} ${jetbrainsMono.variable} bg-bg text-ink min-h-screen flex flex-col transition-colors`}>
        <a href="#main-content" className="skip-link bg-primary text-primary-on px-4 py-2 rounded-control text-sm font-medium">
          {t('label')}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <NotificationsProvider>
                <ToastProvider>
                  <Navbar />
                  <main id="main-content" className="flex-1">{children}</main>
                  <Footer />
                </ToastProvider>
              </NotificationsProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
