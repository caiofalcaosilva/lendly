'use client'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { requestsService } from '@/services/requests'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  requestId: string
  currentExpectedReturnDate: string
  onClose: () => void
  onSuccess: () => void
}

export default function ExtensionModal({ requestId, currentExpectedReturnDate, onClose, onSuccess }: Props) {
  const minDate = new Date(new Date(currentExpectedReturnDate).getTime() + 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const [newDate, setNewDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ExtensionModal')

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
        <p className="text-sm text-gray-600 dark:text-gray-400">
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
