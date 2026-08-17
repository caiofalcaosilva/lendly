'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { reviewsService } from '@/services/reviews'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import StarRating from '@/components/ui/StarRating'

interface Props {
  requestId: string
  reviewedName: string
  onClose: () => void
  onSuccess: () => void
}

const RATING_KEYS = ['', 'veryBad', 'bad', 'regular', 'good', 'excellent']

export default function ReviewModal({ requestId, reviewedName, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
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
          <p className="text-sm text-ink-muted mb-3">{t('subtitle', { name: reviewedName })}</p>
          <StarRating rating={rating} onChange={setRating} size="lg" className="justify-center" />
          {rating > 0 && (
            <p className="text-center text-sm text-ink-muted mt-2">
              {t(`ratings.${RATING_KEYS[rating]}`)}
            </p>
          )}
        </div>

        <Textarea
          label={t('comment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t('commentPlaceholder')}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

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
