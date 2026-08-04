import Link from 'next/link'
import { Star, HandHelping, PackageCheck, Trash2 } from 'lucide-react'
import { Review } from '@/types'
import { formatDate } from '@/lib/utils'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`}
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
}

export default function ReviewCard({ review, linkItem = true, onDelete }: Props) {
  const isLender = review.reviewed_role === 'owner'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
      {/* Role badge + item */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isLender
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          {isLender ? (
            <><HandHelping className="w-3 h-3" /> Emprestou</>
          ) : (
            <><PackageCheck className="w-3 h-3" /> Pegou emprestado</>
          )}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(review.created_at)}</span>
          {onDelete && (
            <button
              onClick={onDelete}
              title="Remover avaliação"
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Item name */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Produto:{' '}
        {linkItem ? (
          <Link
            href={`/items/${review.item_id}`}
            className="font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          >
            {review.item_title}
          </Link>
        ) : (
          <span className="font-medium text-gray-700 dark:text-gray-300">{review.item_title}</span>
        )}
      </div>

      {/* Stars */}
      <Stars rating={review.rating} />

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{review.comment}</p>
      )}

      {/* Reviewer */}
      <p className="text-xs text-gray-400 dark:text-gray-500">— {review.reviewer_name}</p>
    </div>
  )
}
