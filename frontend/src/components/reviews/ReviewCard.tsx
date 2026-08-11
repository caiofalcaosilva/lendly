import { Link } from '@/i18n/navigation'
import { Star, HandHelping, PackageCheck, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Review } from '@/types'
import { formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-ink-subtle'}`}
        />
      ))}
    </div>
  )
}

interface Props {
  review: Review
  /** When true, links item title to /items/:id */
  linkItem?: boolean
  /** Admin-only — shows a delete button when provided */
  onDelete?: () => void
  /** 'received' shows who wrote it (default); 'given' shows who it's about — for a "reviews I wrote" list, showing the author is redundant */
  perspective?: 'received' | 'given'
}

export default function ReviewCard({ review, linkItem = true, onDelete, perspective = 'received' }: Props) {
  const isLender = review.reviewed_role === 'owner'
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ReviewCard')

  return (
    <div className="bg-surface rounded-panel border border-border p-4 space-y-3">
      {/* Role badge + item */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isLender
              ? 'bg-primary-subtle text-primary'
              : 'bg-info-subtle text-info'
          }`}
        >
          {isLender ? (
            <><HandHelping className="w-3 h-3" /> {t('lent')}</>
          ) : (
            <><PackageCheck className="w-3 h-3" /> {t('borrowed')}</>
          )}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-ink-subtle">{formatDate(review.created_at, locale)}</span>
          {onDelete && (
            <button
              onClick={onDelete}
              title={t('removeReview')}
              aria-label={t('removeReview')}
              className="text-ink-subtle hover:text-danger transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Item name */}
      <div className="text-xs text-ink-muted">
        {t('product')}{' '}
        {linkItem ? (
          <Link
            href={`/items/${review.item_id}`}
            className="font-medium text-ink-muted hover:text-primary transition-colors"
          >
            {review.item_title}
          </Link>
        ) : (
          <span className="font-medium text-ink-muted">{review.item_title}</span>
        )}
      </div>

      {/* Stars */}
      <Stars rating={review.rating} />

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-ink-muted leading-relaxed">{review.comment}</p>
      )}

      {/* Reviewer, or who it's about when viewing your own given reviews */}
      {perspective === 'given' ? (
        <p className="text-xs text-ink-subtle">{t('to', { name: review.reviewed_name })}</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <Avatar name={review.reviewer_name} avatarUrl={review.reviewer_avatar_url} size="sm" />
          <p className="text-xs text-ink-subtle">{review.reviewer_name}</p>
        </div>
      )}
    </div>
  )
}
