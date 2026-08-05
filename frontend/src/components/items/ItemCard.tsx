'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { MapPin, Star, Package, Navigation, Heart, LocateFixed } from 'lucide-react'
import { Category, Item } from '@/types'
import { getCategoryLabel, getSubcategoryLabel, formatCurrency, formatDistance } from '@/lib/utils'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import BusinessBadge from '@/components/ui/BusinessBadge'
import { useAuth } from '@/contexts/AuthContext'
import { itemsService } from '@/services/items'
import { categoriesService } from '@/services/categories'

const CATEGORY_COLORS: Record<string, string> = {
  tools: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
  electronics: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  sports: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  garden: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
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
    } finally {
      setTogglingFavorite(false)
    }
  }

  return (
    <Link href={`/items/${item.id}`} className="group block h-full">
      <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
          {photo ? (
            <Image
              src={photo}
              alt={item.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
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
          <div className="absolute top-2.5 left-2.5">
            {item.availability_type === 'free' ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-sm">
                Gratuito
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-gray-900/90 text-gray-800 dark:text-gray-100 shadow-sm">
                {formatCurrency(item.daily_rate ?? 0)}<span className="font-normal text-gray-500 dark:text-gray-400">/dia</span>
              </span>
            )}
          </div>

          {/* Favorite toggle */}
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
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
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate() }}
              aria-label="Ver no mapa"
              title="Ver no mapa"
              className="absolute top-2.5 right-11 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors"
            >
              <LocateFixed className="w-4 h-4 text-white" />
            </button>
          )}

          {/* Distance badge */}
          {distanceKm != null && (
            <div className="absolute bottom-2.5 right-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
                <Navigation className="w-2.5 h-2.5" />
                {formatDistance(distanceKm)}
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
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors flex-1 mb-3">
            {item.title}
          </h3>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="truncate">
                {item.neighborhood || item.city || 'Local não informado'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
