import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
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

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: { pt: '/', en: '/en' },
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
      </head>
      <body className={`${inter.className} bg-bg text-ink min-h-screen flex flex-col transition-colors`}>
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
