'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Star, Package, ArrowLeft, Calendar } from 'lucide-react'
import { User, Item, Review } from '@/types'
import { usersService } from '@/services/users'
import { reviewsService } from '@/services/reviews'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import ItemCard from '@/components/items/ItemCard'
import ReviewCard from '@/components/reviews/ReviewCard'

export default function UserPublicPage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      usersService.getPublic(id),
      usersService.getPublicItems(id),
      reviewsService.forUser(id),
    ])
      .then(([u, its, revs]) => {
        setUser(u)
        setItems(its.filter((i) => i.is_active))
        setReviews(revs)
      })
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  if (notFound || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Usuário não encontrado</h2>
        <Link href="/items" className="text-green-600 text-sm mt-3 inline-block">
          ← Voltar aos itens
        </Link>
      </div>
    )
  }

  const location = [user.neighborhood, user.city, user.state].filter(Boolean).join(', ')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/items"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos itens
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-bold text-green-600">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>

            {location && (
              <p className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {location}
              </p>
            )}

            <p className="flex items-center gap-1.5 text-gray-400 text-xs mt-1">
              <Calendar className="w-3 h-3" />
              Membro desde {formatDate(user.created_at)}
            </p>
          </div>

          <div className="flex flex-col items-center bg-yellow-50 rounded-xl px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold text-gray-900">
                {user.average_rating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {user.rating_count} {user.rating_count === 1 ? 'avaliação' : 'avaliações'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Itens disponíveis
            <span className="ml-2 text-sm font-normal text-gray-400">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhum item anunciado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Avaliações recebidas
            <span className="ml-2 text-sm font-normal text-gray-400">({reviews.length})</span>
          </h2>

          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhuma avaliação ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <ReviewCard key={rev.id} review={rev} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
