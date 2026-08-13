'use client'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoanRequest } from '@/types'
import { requestsService } from '@/services/requests'
import Button from '@/components/ui/Button'

interface Props {
  request: LoanRequest
  onConfirmed: () => void
}

const CODE_LENGTH = 6

// Owner-side counterpart to the code the requester is shown once the
// request is accepted (see RequestCard.tsx) — entering it correctly
// completes pickup for both sides at once, no separate requester tap
// needed for delivery-fulfilled requests.
export default function DeliveryCodeConfirm({ request, onConfirmed }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const t = useTranslations('Common.RequestCard')

  const attemptsRemaining = Math.max(
    request.delivery_confirmation_code_max_attempts - request.delivery_confirmation_code_attempts,
    0,
  )
  const exhausted = attemptsRemaining <= 0

  const handleChange = (i: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (text.length === CODE_LENGTH) {
      setDigits(text.split(''))
      inputs.current[CODE_LENGTH - 1]?.focus()
    }
  }

  const submit = async () => {
    const code = digits.join('')
    if (code.length < CODE_LENGTH) return
    setLoading(true)
    setError('')
    try {
      await requestsService.confirmPickupByCode(request.id, code)
      onConfirmed()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorInvalidCode'))
      setDigits(Array(CODE_LENGTH).fill(''))
      inputs.current[0]?.focus()
      // Refreshes delivery_confirmation_code_attempts from the server so
      // the remaining-attempts count stays accurate.
      onConfirmed()
    } finally {
      setLoading(false)
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setError('')
    try {
      await requestsService.regenerateDeliveryCode(request.id)
      setDigits(Array(CODE_LENGTH).fill(''))
      onConfirmed()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorInvalidCode'))
    } finally {
      setRegenerating(false)
    }
  }

  if (exhausted) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-danger">{t('deliveryCodeAttemptsExceeded')}</p>
        <Button size="sm" variant="outline" loading={regenerating} onClick={regenerate}>
          {t('deliveryCodeRegenerate')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">{t('deliveryCodeOwnerLabel')}</p>
      <div className="flex items-center gap-2 flex-wrap" onPaste={handlePaste}>
        <div className="flex gap-1.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-9 h-11 text-center text-lg font-bold border-2 rounded-control outline-none transition-colors text-ink
                ${d ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'}
                focus:border-primary`}
            />
          ))}
        </div>
        <Button size="sm" loading={loading} disabled={digits.join('').length < CODE_LENGTH} onClick={submit}>
          {t('deliveryCodeConfirm')}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-ink-subtle">
        {t('deliveryCodeAttemptsRemaining', { count: attemptsRemaining })}
      </p>
    </div>
  )
}
