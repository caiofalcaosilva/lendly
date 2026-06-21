import Link from 'next/link'
import { Star, HandHelping, PackageCheck } from 'lucide-react'
import { Review } from '@/types'
import { formatDate } from '@/lib/utils'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  )
}

interface Props {
  review: Review
  /** When true, links item title to /items/:id */
  linkItem?: boolean
}

export default function ReviewCard({ review, linkItem = true }: Props) {
  const isLender = review.reviewed_role === 'owner'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Role badge + item */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isLender
              ? 'bg-green-50 text-green-700'
              : 'bg-blue-50 text-blue-700'
          }`}
        >
          {isLender ? (
            <><HandHelping className="w-3 h-3" /> Emprestou</>
          ) : (
            <><PackageCheck className="w-3 h-3" /> Pegou emprestado</>
          )}
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(review.created_at)}</span>
      </div>

      {/* Item name */}
      <div className="text-xs text-gray-500">
        Produto:{' '}
        {linkItem ? (
          <Link
            href={`/items/${review.item_id}`}
            className="font-medium text-gray-700 hover:text-green-600 transition-colors"
          >
            {review.item_title}
          </Link>
        ) : (
          <span className="font-medium text-gray-700">{review.item_title}</span>
        )}
      </div>

      {/* Stars */}
      <Stars rating={review.rating} />

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}

      {/* Reviewer */}
      <p className="text-xs text-gray-400">— {review.reviewer_name}</p>
    </div>
  )
}
