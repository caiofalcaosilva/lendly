'use client'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { claimsService } from '@/services/claims'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Input from '@/components/ui/Input'
import ItemPhotoPicker from '@/components/items/ItemPhotoPicker'

interface Props {
  requestId: string
  declaredValue: number
  onClose: () => void
  onSuccess: () => void
}

export default function ClaimModal({ requestId, declaredValue, onClose, onSuccess }: Props) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.ClaimModal')

  const submit = async () => {
    const requestedAmount = Number(amount)
    if (description.trim().length < 10) return setError(t('errorDescriptionTooShort'))
    if (!amount || Number.isNaN(requestedAmount) || requestedAmount <= 0) {
      return setError(t('errorAmountRequired'))
    }
    if (requestedAmount > declaredValue) return setError(t('errorAmountOverCeiling'))

    setLoading(true)
    setError('')
    try {
      const claim = await claimsService.create(requestId, {
        description: description.trim(),
        requested_amount: requestedAmount,
      })
      for (const file of files) {
        try {
          await claimsService.uploadPhoto(claim.id, file)
        } catch {
          // Claim already exists — don't block the flow over one failed
          // photo, same tradeoff as ItemForm's photo upload loop.
        }
      }
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
          {t('ceiling', { amount: formatCurrency(declaredValue, locale) })}
        </p>

        <Textarea
          label={t('description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={t('descriptionPlaceholder')}
          required
        />

        <Input
          label={t('requestedAmount')}
          type="number"
          step="0.01"
          min="0.01"
          max={declaredValue}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          required
        />

        <ItemPhotoPicker files={files} onChange={setFiles} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button onClick={submit} loading={loading} className="flex-1">
            {t('submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
