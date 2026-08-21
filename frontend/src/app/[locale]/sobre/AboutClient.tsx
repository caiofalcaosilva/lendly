'use client'
import { Link } from '@/i18n/navigation'
import { Leaf, ArrowRight, Users, ShieldCheck, ToggleLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

const PILLAR_ICONS = {
  neighborhood: Users,
  trust: ShieldCheck,
  reuse: Leaf,
  caution: ToggleLeft,
} as const
const PILLAR_KEYS = ['neighborhood', 'trust', 'reuse', 'caution'] as const

export default function AboutClient() {
  const { isAuthenticated } = useAuth()
  const t = useTranslations('About')

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-bg dark:via-bg dark:to-surface-2 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-subtle text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" />
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-6 leading-[1.15]">
            {t('heroTitle')}
          </h1>
          <p className="text-lg text-ink-muted max-w-xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold tracking-tight text-center text-ink mb-3">{t('pillarsTitle')}</h2>
          <p className="text-center text-ink-muted mb-12 max-w-xl mx-auto">{t('pillarsSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PILLAR_KEYS.map((key) => {
              const Icon = PILLAR_ICONS[key]
              return (
                <div key={key} className="bg-surface border border-border rounded-panel p-6">
                  <div className="w-11 h-11 bg-primary-subtle rounded-panel flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">{t(`pillars.${key}.title`)}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{t(`pillars.${key}.desc`)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-20 bg-primary-subtle">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink mb-3">{t('ctaTitle')}</h2>
          <p className="text-ink-muted mb-8">{t('ctaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on font-semibold px-8 py-3 rounded-control hover:bg-primary-hover transition-colors"
              >
                {t('ctaDashboard')} <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on font-semibold px-8 py-3 rounded-control hover:bg-primary-hover transition-colors"
              >
                {t('ctaCreateAccount')} <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link
              href="/items"
              className="inline-flex items-center justify-center gap-2 border border-border text-ink-muted font-semibold px-8 py-3 rounded-control hover:bg-surface transition-colors"
            >
              {t('ctaExplore')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
