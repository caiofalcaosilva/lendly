'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { MapPin, Star, Package, ArrowLeft, Calendar, Clock, Phone, Globe, Flag, Instagram, MessageCircle, Heart } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { PublicUser, Item, Review } from '@/types'
import { usersService } from '@/services/users'
import { reviewsService } from '@/services/reviews'
import { formatDate, isHttpUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'
import ItemCard from '@/components/items/ItemCard'
import ReviewCard from '@/components/reviews/ReviewCard'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import BusinessBadge from '@/components/ui/BusinessBadge'
import ReputationBadges from '@/components/ui/ReputationBadges'
import ReportModal from '@/components/reports/ReportModal'
import Avatar from '@/components/ui/Avatar'

export default function UserPublicClient() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Users.Id')

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
    if (!confirm(t('confirmDeleteReview'))) return
    await reviewsService.remove(reviewId)
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    const updated = await usersService.getPublic(id)
    setUser(updated)
  }

  const toggleFavorite = async () => {
    if (!user) return
    setTogglingFavorite(true)
    try {
      const updated = user.is_favorited
        ? await usersService.unfavoriteUser(user.id)
        : await usersService.favoriteUser(user.id)
      setUser(updated)
    } finally {
      setTogglingFavorite(false)
    }
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
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">{t('notFound')}</h2>
        <Link href="/items" className="text-green-600 dark:text-green-400 text-sm mt-3 inline-block">
          ← {t('backToItems')}
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
        <ArrowLeft className="w-4 h-4" /> {t('backToItems')}
      </Link>

      {/* Profile header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar name={user.name} avatarUrl={user.avatar_url} size="lg" />

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
              {t('memberSince', { date: formatDate(user.created_at, locale) })}
            </p>

            {user.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{user.bio}</p>
            )}

            <div className="mt-3">
              <ReputationBadges
                reliabilityScore={user.reliability_score}
                reliabilityCount={user.reliability_count}
                onTimeRate={user.on_time_rate}
                finishedLoansCount={user.finished_loans_count}
                averageRating={user.average_rating}
                ratingCount={user.rating_count}
                avgResponseMinutes={user.avg_response_minutes}
                responseCount={user.response_count}
              />
            </div>

            {user.account_type === 'business' && (user.business_hours || user.business_phone || user.website || user.instagram || user.whatsapp) && (
              <div className="flex flex-col gap-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
                {user.business_hours && (
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{user.business_hours}</span>
                )}
                {user.business_phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{user.business_phone}</span>
                )}
                {user.website && isHttpUrl(user.website) && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-green-600 dark:hover:text-green-400 transition-colors min-w-0">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" /><span className="break-all">{user.website}</span>
                  </a>
                )}
                {user.instagram && (
                  <a
                    href={`https://instagram.com/${user.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />{user.instagram}
                  </a>
                )}
                {user.whatsapp && (
                  <a
                    href={`https://wa.me/55${user.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />{user.whatsapp}
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
              {t('ratingCount', { count: user.rating_count })}
            </p>
            <ReliabilityBadge score={user.reliability_score} count={user.reliability_count} size="md" />
            {isAuthenticated && currentUser?.id !== user.id && (
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={toggleFavorite}
                  disabled={togglingFavorite}
                  className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                    user.is_favorited
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${user.is_favorited ? 'fill-red-500 dark:fill-red-400' : ''}`} />
                  {user.is_favorited ? t('favorited') : t('favorite')}
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Flag className="w-3 h-3" /> {t('report')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('availableItems')}
            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
              <Package className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">{t('noItems')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...items]
                .sort((a, b) => {
                  const fa = user.featured_item_ids.indexOf(a.id)
                  const fb = user.featured_item_ids.indexOf(b.id)
                  if (fa === -1 && fb === -1) return 0
                  if (fa === -1) return 1
                  if (fb === -1) return -1
                  return fa - fb
                })
                .map((item) => (
                  <div key={item.id} className="relative">
                    {user.featured_item_ids.includes(item.id) && (
                      <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 shadow-sm">
                        <Star className="w-2.5 h-2.5 fill-yellow-900" /> {t('featured')}
                      </span>
                    )}
                    <ItemCard item={item} />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('reviewsReceived')}
            <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">({reviews.length})</span>
          </h2>

          {reviews.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <Star className="w-8 h-8 text-gray-200 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">{t('noReviews')}</p>
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
          targetLabel={t('reportTargetLabel')}
          onClose={() => setShowReport(false)}
          onSuccess={() => { setShowReport(false); setReportSent(true) }}
        />
      )}

      {reportSent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {t('reportSent')}
        </div>
      )}
    </div>
  )
}
