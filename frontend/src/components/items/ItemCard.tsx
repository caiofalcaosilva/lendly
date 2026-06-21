import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Star, Package, Navigation } from 'lucide-react'
import { Item } from '@/types'
import { getCategoryLabel, formatCurrency, formatDistance } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  tools: 'text-orange-600 bg-orange-50',
  electronics: 'text-blue-600 bg-blue-50',
  sports: 'text-emerald-600 bg-emerald-50',
  garden: 'text-green-600 bg-green-50',
  kitchen: 'text-rose-600 bg-rose-50',
  books: 'text-indigo-600 bg-indigo-50',
  toys: 'text-purple-600 bg-purple-50',
  clothing: 'text-pink-600 bg-pink-50',
  furniture: 'text-amber-600 bg-amber-50',
  other: 'text-gray-600 bg-gray-50',
}

interface Props {
  item: Item
  distanceKm?: number
}

export default function ItemCard({ item, distanceKm }: Props) {
  const photo = item.photos?.[0]
  const categoryColor = CATEGORY_COLORS[item.category] ?? 'text-gray-600 bg-gray-50'

  return (
    <Link href={`/items/${item.id}`} className="group block h-full">
      <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-100 flex-shrink-0 overflow-hidden">
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
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 text-gray-800 shadow-sm">
                {formatCurrency(item.daily_rate ?? 0)}<span className="font-normal text-gray-500">/dia</span>
              </span>
            )}
          </div>

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
            {getCategoryLabel(item.category)}
          </span>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-green-700 transition-colors flex-1 mb-3">
            {item.title}
          </h3>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
              <span className="truncate">
                {item.neighborhood || item.city || 'Local não informado'}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-medium text-gray-700">
                {item.owner.average_rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
