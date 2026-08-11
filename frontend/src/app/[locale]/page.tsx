'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import {
  Leaf, ArrowRight, ShieldCheck, Users, Star, QrCode, Store,
  Wrench, Laptop, Dumbbell, Sprout, ChefHat, BookOpen, Gamepad2,
  Shirt, Sofa, Package, CheckCircle2, MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { Category } from '@/types'
import { categoriesService } from '@/services/categories'
import Spinner from '@/components/ui/Spinner'

const HOW_IT_WORKS_KEYS = ['step1', 'step2', 'step3'] as const
const TRUST_BAR_KEYS = ['verified', 'pix', 'reviews'] as const
const TRUST_ITEMS = [
  { key: 'verification', icon: ShieldCheck },
  { key: 'groups', icon: Users },
  { key: 'reviews', icon: Star },
  { key: 'payments', icon: QrCode },
] as const
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  tools: Wrench, electronics: Laptop, sports: Dumbbell, garden: Sprout,
  kitchen: ChefHat, books: BookOpen, toys: Gamepad2, clothing: Shirt,
  furniture: Sofa, other: Package,
}
const MAX_CATEGORY_TILES = 9
const BENEFIT_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4'] as const

export default function LandingPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const t = useTranslations('Home')
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    categoriesService.list().then((cats) => setCategories(cats.filter((c) => c.is_active)))
  }, [])

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-bg dark:via-bg dark:to-surface-2 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-subtle text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink mb-6 leading-[1.1]">
            {t('heroTitlePrefix')}{' '}
            <span className="text-primary">{t('heroTitleHighlight')}</span>
          </h1>
          <p className="text-xl text-ink-muted mb-10 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on font-semibold px-8 py-3 rounded-control hover:bg-primary-hover transition-colors"
            >
              {t('getStarted')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/items"
              className="inline-flex items-center justify-center gap-2 border border-border text-ink-muted font-semibold px-8 py-3 rounded-control hover:bg-surface-2 transition-colors"
            >
              {t('exploreItems')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-ink-muted">
            {TRUST_BAR_KEYS.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {t(`trustBar.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-surface">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-ink mb-12">{t('howItWorksTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS_KEYS.map((key, i) => (
              <div key={key} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-on rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-ink">{t(`howItWorks.${key}.title`)}</h3>
                <p className="text-ink-muted text-sm">{t(`howItWorks.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories — pulled live from the platform's category catalog, so this
          section can't silently drift out of sync the way a hardcoded list did. */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-ink mb-12">{t('categoriesTitle')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.slice(0, MAX_CATEGORY_TILES).map((category) => {
              const Icon = CATEGORY_ICONS[category.key] ?? Package
              return (
                <Link
                  key={category.key}
                  href={`/items?category=${category.key}`}
                  className="bg-surface rounded-panel p-6 text-center border border-border hover:shadow-elevated hover:-translate-y-0.5 transition-all group"
                >
                  <Icon className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-ink text-sm">{category.label}</span>
                </Link>
              )
            })}
            <Link
              href="/items"
              className="bg-surface rounded-panel p-6 text-center border border-border hover:shadow-elevated hover:-translate-y-0.5 transition-all group"
            >
              <Package className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-ink text-sm">{t('categories.viewAll')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & safety — the concrete mechanisms (not just adjectives) that
          make lending to someone you just met on the app feel safe. */}
      <section className="py-20 bg-surface">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-ink mb-3">{t('trustTitle')}</h2>
          <p className="text-center text-ink-muted mb-12 max-w-2xl mx-auto">{t('trustSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {TRUST_ITEMS.map(({ icon: Icon, key }) => (
              <div key={key} className="text-center">
                <div className="w-14 h-14 bg-primary-subtle rounded-panel flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-ink">{t(`trust.${key}.title`)}</h3>
                <p className="text-ink-muted text-sm">{t(`trust.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coordination, in-app */}
      <section className="py-16 bg-surface-2">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 bg-surface rounded-panel flex items-center justify-center flex-shrink-0 border border-border">
            <MessageCircle className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink mb-1">{t('chat.title')}</h2>
            <p className="text-ink-muted text-sm">{t('chat.desc')}</p>
          </div>
        </div>
      </section>

      {/* Businesses */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 bg-primary-subtle rounded-panel flex items-center justify-center flex-shrink-0">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-ink mb-1">{t('business.title')}</h2>
            <p className="text-ink-muted text-sm">{t('business.desc')}</p>
          </div>
          <Link
            href="/empresas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline flex-shrink-0"
          >
            {t('business.cta')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-primary-subtle">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-ink mb-6">
                {t('benefitsTitle')}
              </h2>
              <ul className="space-y-4">
                {BENEFIT_KEYS.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-ink-muted">{t(`benefits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface rounded-panel p-8 shadow-elevated">
              <div className="text-center">
                <div className="text-5xl font-extrabold tracking-tight text-primary mb-2">100%</div>
                <div className="text-ink-muted font-medium mb-6">{t('freeToStart')}</div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-on font-semibold px-6 py-3 rounded-control hover:bg-primary-hover transition-colors w-full"
                >
                  {t('createFreeAccount')} <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-xs text-ink-subtle mt-3">{t('noCreditCard')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
