'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { reviewsService } from '@/services/reviews'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  requestId: string
  reviewedName: string
  onClose: () => void
  onSuccess: () => void
}

const RATING_KEYS = ['', 'veryBad', 'bad', 'regular', 'good', 'excellent']

export default function ReviewModal({ requestId, reviewedName, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.ReviewModal')

  const submit = async () => {
    if (!rating) return setError(t('errorSelectRating'))
    setLoading(true)
    setError('')
    try {
      await reviewsService.create(requestId, { rating, comment: comment || undefined })
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title', { name: reviewedName })}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('subtitle', { name: reviewedName })}</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${n <= (hovered || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {t(`ratings.${RATING_KEYS[rating]}`)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('comment')}</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('commentPlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={submit} loading={loading} disabled={!rating} className="flex-1">
            {t('submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
