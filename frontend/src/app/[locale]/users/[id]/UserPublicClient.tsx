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
import Badge from '@/components/ui/Badge'
import ReportModal from '@/components/reports/ReportModal'
import Avatar from '@/components/ui/Avatar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/contexts/ToastContext'

export default function UserPublicClient() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null)
  const [deletingReview, setDeletingReview] = useState(false)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Users.Id')
  const toast = useToast()

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

  const handleDeleteReview = async () => {
    if (!deleteReviewId) return
    setDeletingReview(true)
    try {
      await reviewsService.remove(deleteReviewId)
      setReviews((prev) => prev.filter((r) => r.id !== deleteReviewId))
      const updated = await usersService.getPublic(id)
      setUser(updated)
      setDeleteReviewId(null)
    } catch {
      toast.error(t('errorDeletingReview'))
    } finally {
      setDeletingReview(false)
    }
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
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  if (notFound || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-ink-muted">{t('notFound')}</h1>
        <Link href="/items" className="text-primary text-sm mt-3 inline-block">
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
        className="inline-flex items-center gap-2 text-ink-muted hover:text-ink text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('backToItems')}
      </Link>

      {/* Profile header */}
      <div className="bg-surface rounded-panel border border-border p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar name={user.name} avatarUrl={user.avatar_url} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{user.trade_name || user.name}</h1>
              <BusinessBadge accountType={user.account_type} size="md" />
            </div>
            {user.account_type === 'business' && user.business_category && (
              <p className="text-sm text-ink-muted mt-0.5">{user.business_category}</p>
            )}

            {location && (
              <p className="flex items-center gap-1.5 text-ink-muted text-sm mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {location}
              </p>
            )}

            <p className="flex items-center gap-1.5 text-ink-subtle text-xs mt-1">
              <Calendar className="w-3 h-3" />
              {t.rich('memberSince', {
                date: formatDate(user.created_at, locale),
                d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span>,
              })}
            </p>

            {user.bio && (
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">{user.bio}</p>
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
              <div className="flex flex-col gap-1 mt-3 text-xs text-ink-muted">
                {user.business_hours && (
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{user.business_hours}</span>
                )}
                {user.business_phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /><span className="font-mono tabular-nums">{user.business_phone}</span></span>
                )}
                {user.website && isHttpUrl(user.website) && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors min-w-0">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" /><span className="break-all">{user.website}</span>
                  </a>
                )}
                {user.instagram && (
                  <a
                    href={`https://instagram.com/${user.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />{user.instagram}
                  </a>
                )}
                {user.whatsapp && (
                  <a
                    href={`https://wa.me/55${user.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /><span className="font-mono tabular-nums">{user.whatsapp}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center bg-yellow-50 dark:bg-yellow-900/20 rounded-panel px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold font-mono tabular-nums text-ink">
                {user.average_rating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-ink-muted mb-2">
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
                      : 'text-ink-subtle hover:text-red-500 dark:hover:text-red-400'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${user.is_favorited ? 'fill-red-500 dark:fill-red-400' : ''}`} />
                  {user.is_favorited ? t('favorited') : t('favorite')}
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-1 text-xs text-ink-subtle hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
          <h2 className="text-lg font-semibold text-ink mb-4">
            {t('availableItems')}
            <span className="ml-2 text-sm font-normal text-ink-subtle">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <div className="bg-surface rounded-panel border border-border p-10 text-center">
              <Package className="w-10 h-10 text-ink-subtle mx-auto mb-3" />
              <p className="text-ink-subtle text-sm">{t('noItems')}</p>
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
                      <Badge
                        size="sm"
                        icon={<Star className="w-2.5 h-2.5 fill-yellow-900" />}
                        className="absolute top-2 left-2 z-10 !bg-yellow-400 !text-yellow-900"
                      >
                        {t('featured')}
                      </Badge>
                    )}
                    <ItemCard item={item} />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h2 className="text-lg font-semibold text-ink mb-4">
            {t('reviewsReceived')}
            <span className="ml-2 text-sm font-normal text-ink-subtle">({reviews.length})</span>
          </h2>

          {reviews.length === 0 ? (
            <div className="bg-surface rounded-panel border border-border p-8 text-center">
              <Star className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
              <p className="text-ink-subtle text-sm">{t('noReviews')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <ReviewCard
                  key={rev.id}
                  review={rev}
                  onDelete={currentUser?.is_admin ? () => setDeleteReviewId(rev.id) : undefined}
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
          onSuccess={() => { setShowReport(false); toast.success(t('reportSent')) }}
        />
      )}

      <ConfirmDialog
        open={deleteReviewId !== null}
        onClose={() => setDeleteReviewId(null)}
        onConfirm={handleDeleteReview}
        title={t('confirmDeleteReviewTitle')}
        description={t('confirmDeleteReview')}
        loading={deletingReview}
      />
    </div>
  )
}
