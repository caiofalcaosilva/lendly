'use client'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'

export default function Footer() {
  const { isAuthenticated } = useAuth()
  const t = useTranslations('Common.Footer')

  return (
    <footer className="bg-surface border-t border-border mt-auto transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/">
          <Logo markClassName="w-6 h-6" />
        </Link>
        <p className="text-sm text-ink-muted text-center">{t('tagline')}</p>
        <div className="flex gap-4 text-sm text-ink-muted">
          <Link href="/sobre" className="hover:text-ink transition-colors">{t('about')}</Link>
          <Link href="/items" className="hover:text-ink transition-colors">{t('explore')}</Link>
          {isAuthenticated ? (
            <Link href="/dashboard" className="hover:text-ink transition-colors">{t('dashboard')}</Link>
          ) : (
            <Link href="/register" className="hover:text-ink transition-colors">{t('createAccount')}</Link>
          )}
          <Link href="/termos" className="hover:text-ink transition-colors">{t('terms')}</Link>
          <Link href="/privacidade" className="hover:text-ink transition-colors">{t('privacy')}</Link>
        </div>
      </div>
    </footer>
  )
}
