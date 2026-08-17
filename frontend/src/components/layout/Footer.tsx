'use client'
import { useTranslations } from 'next-intl'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

// Placeholder hrefs (#) until the platform's real social accounts exist —
// swap these for the real URLs when they do, nothing else needs to change.
const SOCIAL_LINKS = [
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: MessageCircle, href: '#', label: 'WhatsApp' },
]

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
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-ink-muted">
          <Link href="/sobre" className="hover:text-ink transition-colors">{t('about')}</Link>
          <Link href="/items" className="hover:text-ink transition-colors">{t('explore')}</Link>
          {isAuthenticated ? (
            <Link href="/dashboard" className="hover:text-ink transition-colors">{t('dashboard')}</Link>
          ) : (
            <Link href="/register" className="hover:text-ink transition-colors">{t('createAccount')}</Link>
          )}
          <Link href="/termos" className="hover:text-ink transition-colors">{t('terms')}</Link>
          <Link href="/privacidade" className="hover:text-ink transition-colors">{t('privacy')}</Link>
          <div className="flex items-center gap-3 pl-1">
            {SOCIAL_LINKS.map(({ icon: Icon, href, label }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-ink-muted hover:text-ink transition-colors">
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  )
}
