'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import { MapPin, Star, Package, Navigation, Heart, LocateFixed } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Category, Item } from '@/types'
import { getCategoryLabel, getSubcategoryLabel, formatCurrency, formatDistance } from '@/lib/utils'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import BusinessBadge from '@/components/ui/BusinessBadge'
import Tooltip from '@/components/ui/Tooltip'
import { useAuth } from '@/contexts/AuthContext'
import { itemsService } from '@/services/items'
import { categoriesService } from '@/services/categories'
import { useToast } from '@/contexts/ToastContext'

const CATEGORY_COLORS: Record<string, string> = {
  tools: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
  electronics: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  sports: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  // Deliberately not green — that's the brand/primary color, reserved for
  // actions, so a category tag can't be mistaken for one.
  garden: 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-900/30',
  kitchen: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30',
  books: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
  toys: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
  clothing: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30',
  furniture: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  other: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700',
}

interface Props {
  item: Item
  distanceKm?: number
  onFavoriteChange?: (item: Item, favorited: boolean) => void
  /** When provided, shows a "ver no mapa" pin button — used by the /items
   * map/list toggle to jump straight to this item's marker. */
  onLocate?: () => void
}

export default function ItemCard({ item, distanceKm, onFavoriteChange, onLocate }: Props) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ItemCard')
  const toast = useToast()
  const photo = item.photos?.[0]
  const categoryColor = CATEGORY_COLORS[item.category] ?? 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
  const [favorited, setFavorited] = useState(item.is_favorited)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (togglingFavorite) return
    setTogglingFavorite(true)
    const next = !favorited
    setFavorited(next) // optimistic
    try {
      await (next ? itemsService.favorite(item.id) : itemsService.unfavorite(item.id))
      onFavoriteChange?.(item, next)
    } catch {
      setFavorited(!next) // revert on failure
      toast.error(t('favoriteError'))
    } finally {
      setTogglingFavorite(false)
    }
  }

  return (
    <Link href={`/items/${item.id}`} className="group block h-full">
      <div className="h-full flex flex-col bg-surface rounded-panel border border-border overflow-hidden shadow-subtle motion-safe:hover:shadow-elevated motion-safe:hover:-translate-y-0.5 transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-surface-2 flex-shrink-0 overflow-hidden">
          {photo ? (
            <Image
              src={photo}
              alt={item.title}
              fill
              className="object-cover motion-safe:group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className={`absolute inset-0 flex items-center justify-center ${categoryColor}`}>
              <Package className="w-14 h-14 opacity-30" />
            </div>
          )}

          {/* Gradient overlay */}
          {photo && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          )}

          {/* Price / free badge */}
          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
            {item.availability_type === 'free' ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary text-primary-on shadow-elevated">
                {t('free')}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-black/70 text-ink shadow-elevated">
                <span className="font-mono tabular-nums">{formatCurrency(item.daily_rate ?? 0, locale)}</span><span className="font-normal text-ink-muted">{t('perDay')}</span>
              </span>
            )}
            {item.quantity_total > 1 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-black/70 text-ink shadow-elevated">
                {t('unitsAvailable', { count: item.quantity_total })}
              </span>
            )}
          </div>

          {/* Favorite toggle */}
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={favorited ? t('removeFavorite') : t('addFavorite')}
            className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                favorited ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </button>

          {/* Locate on map */}
          {onLocate && item.latitude != null && item.longitude != null && (
            <div className="absolute top-2.5 right-11">
              <Tooltip label={t('viewOnMap')}>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate() }}
                  aria-label={t('viewOnMap')}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors"
                >
                  <LocateFixed className="w-4 h-4 text-white" />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Distance badge */}
          {distanceKm != null && (
            <div className="absolute bottom-2.5 right-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
                <Navigation className="w-2.5 h-2.5" />
                <span className="font-mono tabular-nums">{formatDistance(distanceKm)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-3.5">
          {/* Category */}
          <span className={`inline-flex self-start items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide mb-2 ${categoryColor}`}>
            {getCategoryLabel(categories, item.category)}
            {getSubcategoryLabel(categories, item.category, item.subcategory) && (
              <span className="normal-case font-normal opacity-75 ml-1">
                · {getSubcategoryLabel(categories, item.category, item.subcategory)}
              </span>
            )}
          </span>

          {/* Title */}
          <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1 mb-3">
            {item.title}
          </h3>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-ink-muted min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0 text-ink-subtle" />
              <span className="truncate">
                {item.neighborhood || item.city || t('noLocation')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium text-ink-muted font-mono tabular-nums">
                  {item.owner.average_rating.toFixed(1)}
                </span>
              </div>
              <ReliabilityBadge score={item.owner.reliability_score} count={item.owner.reliability_count} />
              <BusinessBadge accountType={item.owner.account_type} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
