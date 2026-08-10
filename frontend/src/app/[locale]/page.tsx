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
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" />
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
            {t('heroTitlePrefix')}{' '}
            <span className="text-green-600 dark:text-green-400">{t('heroTitleHighlight')}</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              {t('getStarted')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/items"
              className="inline-flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-8 py-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              {t('exploreItems')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500 dark:text-gray-400">
            {TRUST_BAR_KEYS.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                {t(`trustBar.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">{t('howItWorksTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS_KEYS.map((key, i) => (
              <div key={key} className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t(`howItWorks.${key}.title`)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t(`howItWorks.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories — pulled live from the platform's category catalog, so this
          section can't silently drift out of sync the way a hardcoded list did. */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">{t('categoriesTitle')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.slice(0, MAX_CATEGORY_TILES).map((category) => {
              const Icon = CATEGORY_ICONS[category.key] ?? Package
              return (
                <Link
                  key={category.key}
                  href={`/items?category=${category.key}`}
                  className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow group"
                >
                  <Icon className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{category.label}</span>
                </Link>
              )
            })}
            <Link
              href="/items"
              className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow group"
            >
              <Package className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{t('categories.viewAll')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & safety — the concrete mechanisms (not just adjectives) that
          make lending to someone you just met on the app feel safe. */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-3">{t('trustTitle')}</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">{t('trustSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {TRUST_ITEMS.map(({ icon: Icon, key }) => (
              <div key={key} className="text-center">
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t(`trust.${key}.title`)}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t(`trust.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coordination, in-app */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <MessageCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('chat.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t('chat.desc')}</p>
          </div>
        </div>
      </section>

      {/* Businesses */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Store className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('business.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t('business.desc')}</p>
          </div>
          <Link
            href="/empresas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400 hover:underline flex-shrink-0"
          >
            {t('business.cta')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-green-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {t('benefitsTitle')}
              </h2>
              <ul className="space-y-4">
                {BENEFIT_KEYS.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{t(`benefits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-sm">
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 dark:text-green-400 mb-2">100%</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium mb-6">{t('freeToStart')}</div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-700 transition-colors w-full"
                >
                  {t('createFreeAccount')} <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('noCreditCard')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
