'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { reportsService } from '@/services/reports'
import { ReportReason } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  itemId?: string
  reportedUserId?: string
  targetLabel: string
  onClose: () => void
  onSuccess: () => void
}

const REASONS: ReportReason[] = ['spam', 'fake_item', 'inappropriate', 'fraud', 'other']

export default function ReportModal({ itemId, reportedUserId, targetLabel, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.ReportModal')

  const submit = async () => {
    if (!reason) return setError(t('errorSelectReason'))
    setLoading(true)
    setError('')
    try {
      await reportsService.create({
        item_id: itemId,
        reported_user_id: reportedUserId,
        reason,
        description: description || undefined,
      })
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title', { target: targetLabel })}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('reason')}</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">{t('select')}</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>{t(`reasons.${r}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('details')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('detailsPlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={submit} loading={loading} disabled={!reason} variant="danger" className="flex-1">
            {t('submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
