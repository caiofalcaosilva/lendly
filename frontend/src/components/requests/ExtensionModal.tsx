'use client'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { requestsService } from '@/services/requests'
import { itemsService } from '@/services/items'
import { formatDate, formatCurrency } from '@/lib/utils'
import { calculateRentalPrice } from '@/lib/pricing'
import { Item } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  requestId: string
  itemId: string
  currentExpectedReturnDate: string
  onClose: () => void
  onSuccess: () => void
}

export default function ExtensionModal({ requestId, itemId, currentExpectedReturnDate, onClose, onSuccess }: Props) {
  const minDate = new Date(new Date(currentExpectedReturnDate).getTime() + 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const [newDate, setNewDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [item, setItem] = useState<Item | null>(null)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ExtensionModal')

  useEffect(() => {
    itemsService.get(itemId).then(setItem).catch(() => {})
  }, [itemId])

  const estimatedCost = (() => {
    if (!item || item.availability_type !== 'paid' || !newDate) return null
    const days = Math.round(
      (new Date(newDate).getTime() - new Date(currentExpectedReturnDate).getTime()) / 86_400_000,
    )
    if (days <= 0) return null
    return calculateRentalPrice(item, days)
  })()

  const submit = async () => {
    if (!newDate) return setError(t('errorChooseDate'))
    setLoading(true)
    setError('')
    try {
      await requestsService.requestExtension(requestId, new Date(newDate).toISOString())
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title')}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          {t('currentReturnDate')} <strong>{formatDate(currentExpectedReturnDate, locale)}</strong>
        </p>

        <Input
          label={t('newReturnDate')}
          type="date"
          min={minDate}
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          required
        />

        {estimatedCost != null && (
          <div className="flex items-center justify-between p-3 bg-primary-subtle rounded-control">
            <span className="text-sm text-ink-muted">{t('estimatedCost')}</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(estimatedCost, locale)}</span>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button onClick={submit} loading={loading} disabled={!newDate} className="flex-1">
            {t('submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
