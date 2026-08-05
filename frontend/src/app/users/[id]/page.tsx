'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Star, Package, ArrowLeft, Calendar, Clock, Phone, Globe, Flag } from 'lucide-react'
import { PublicUser, Item, Review } from '@/types'
import { usersService } from '@/services/users'
import { reviewsService } from '@/services/reviews'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'
import ItemCard from '@/components/items/ItemCard'
import ReviewCard from '@/components/reviews/ReviewCard'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import BusinessBadge from '@/components/ui/BusinessBadge'
import ReputationBadges from '@/components/ui/ReputationBadges'
import ReportModal from '@/components/reports/ReportModal'

export default function UserPublicPage() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)

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

  useEffect(() => {
    if (!reportSent) return
    const timer = setTimeout(() => setReportSent(false), 3000)
    return () => clearTimeout(timer)
  }, [reportSent])

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Remover esta avaliação? A nota do usuário será recalculada.')) return
    await reviewsService.remove(reviewId)
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    const updated = await usersService.getPublic(id)
    setUser(updated)
  }

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
        <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Usuário não encontrado</h2>
        <Link href="/items" className="text-green-600 dark:text-green-400 text-sm mt-3 inline-block">
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
        className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos itens
      </Link>

      {/* Profile header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.trade_name || user.name}</h1>
              <BusinessBadge accountType={user.account_type} size="md" />
            </div>
            {user.account_type === 'business' && user.business_category && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.business_category}</p>
            )}

            {location && (
              <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {location}
              </p>
            )}

            <p className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-xs mt-1">
              <Calendar className="w-3 h-3" />
              Membro desde {formatDate(user.created_at)}
            </p>

            <div className="mt-3">
              <ReputationBadges
                reliabilityScore={user.reliability_score}
                reliabilityCount={user.reliability_count}
                onTimeRate={user.on_time_rate}
                finishedLoansCount={user.finished_loans_count}
                averageRating={user.average_rating}
                ratingCount={user.rating_count}
              />
            </div>

            {user.account_type === 'business' && (user.business_hours || user.business_phone || user.website) && (
              <div className="flex flex-col gap-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
                {user.business_hours && (
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{user.business_hours}</span>
                )}
                {user.business_phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{user.business_phone}</span>
                )}
                {user.website && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                    <Globe className="w-3.5 h-3.5" />{user.website}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {user.average_rating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {user.rating_count} {user.rating_count === 1 ? 'avaliação' : 'avaliações'}
            </p>
            <ReliabilityBadge score={user.reliability_score} count={user.reliability_count} size="md" />
            {isAuthenticated && currentUser?.id !== user.id && (
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors mt-3"
              >
                <Flag className="w-3 h-3" /> Denunciar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Itens disponíveis
            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
              <Package className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhum item anunciado ainda.</p>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Avaliações recebidas
            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">({reviews.length})</span>
          </h2>

          {reviews.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <Star className="w-8 h-8 text-gray-200 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma avaliação ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <ReviewCard
                  key={rev.id}
                  review={rev}
                  onDelete={currentUser?.is_admin ? () => handleDeleteReview(rev.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportModal
          reportedUserId={user.id}
          targetLabel="usuário"
          onClose={() => setShowReport(false)}
          onSuccess={() => { setShowReport(false); setReportSent(true) }}
        />
      )}

      {reportSent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.
        </div>
      )}
    </div>
  )
}
