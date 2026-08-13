'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { requestsService } from '@/services/requests'
import { Item } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { calculateRentalPrice } from '@/lib/pricing'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

// JS Date#getDay() is 0=domingo...6=sábado; the backend uses Python's
// weekday() convention, 0=segunda...6=domingo. Converting once here keeps
// every other comparison in this file in the backend's terms.
const toBackendWeekday = (dateStr: string) => (new Date(dateStr).getUTCDay() + 6) % 7

function buildSchema(
  availableDays: number[],
  fulfillmentChoiceRequired: boolean,
  t: ReturnType<typeof useTranslations>,
) {
  return z
    .object({
      pickup_date: z.string().min(1, t('errors.pickupDateRequired')),
      expected_return_date: z.string().min(1, t('errors.returnDateRequired')),
      fulfillment_method: z.enum(['pickup', 'delivery']).optional(),
      notes: z.string().max(500).optional(),
    })
    .refine((d) => d.pickup_date < d.expected_return_date, {
      message: t('errors.returnAfterPickup'),
      path: ['expected_return_date'],
    })
    .refine((d) => !fulfillmentChoiceRequired || !!d.fulfillment_method, {
      message: t('errors.fulfillmentMethodRequired'),
      path: ['fulfillment_method'],
    })
    .refine((d) => availableDays.length === 0 || availableDays.includes(toBackendWeekday(d.pickup_date)), {
      message: t('errors.pickupDayUnavailable'),
      path: ['pickup_date'],
    })
    .refine((d) => availableDays.length === 0 || availableDays.includes(toBackendWeekday(d.expected_return_date)), {
      message: t('errors.returnDayUnavailable'),
      path: ['expected_return_date'],
    })
}

interface Props {
  item: Item
  onClose: () => void
}

export default function RequestModal({ item, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.RequestModal')

  const availableDays = item.available_days ?? []
  const fulfillmentOptions = item.fulfillment_options ?? ['pickup']
  const fulfillmentChoiceRequired = fulfillmentOptions.length > 1
  const schema = buildSchema(availableDays, fulfillmentChoiceRequired, t)
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const today = new Date().toISOString().split('T')[0]

  const pickupDate = watch('pickup_date')
  const returnDate = watch('expected_return_date')
  const estimatedTotal = (() => {
    if (item.availability_type !== 'paid' || !pickupDate || !returnDate) return null
    const days = Math.round(
      (new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86_400_000,
    )
    if (days <= 0) return null
    return calculateRentalPrice(item, days)
  })()

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await requestsService.create({
        item_id: item.id,
        pickup_date: new Date(data.pickup_date).toISOString(),
        expected_return_date: new Date(data.expected_return_date).toISOString(),
        fulfillment_method: fulfillmentChoiceRequired ? data.fulfillment_method : fulfillmentOptions[0],
        notes: data.notes,
      })
      onClose()
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title')}>
      <div className="mb-5 p-4 bg-surface-2 rounded-control">
        <p className="font-medium text-ink">{item.title}</p>
        <p className="text-sm text-ink-muted mt-1">
          {item.availability_type === 'free'
            ? t('freeLoan')
            : t('paidRental', { price: formatCurrency(item.daily_rate ?? 0, locale) })}
        </p>
        <p className="text-xs text-ink-subtle mt-1">{t('owner', { name: item.owner.name })}</p>
      </div>

      {error && <div className="mb-4 p-3 bg-danger-subtle text-danger rounded-control text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {fulfillmentChoiceRequired && (
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-2">{t('fulfillmentMethod')}</label>
            <div className="flex gap-6">
              {(['pickup', 'delivery'] as const).map((val) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer text-ink">
                  <input type="radio" value={val} {...register('fulfillment_method')} className="text-primary" />
                  <span className="text-sm">{val === 'pickup' ? t('fulfillmentPickup') : t('fulfillmentDelivery')}</span>
                </label>
              ))}
            </div>
            {errors.fulfillment_method && (
              <p className="text-xs text-danger mt-1">{errors.fulfillment_method.message}</p>
            )}
          </div>
        )}
        {availableDays.length > 0 && (
          <p className="text-xs text-warning bg-warning-subtle border border-warning/30 rounded-control px-3 py-2">
            {t('availableDaysNotice', { days: availableDays.map((d) => t(`weekdays.${WEEKDAY_KEYS[d]}`)).join(', ') })}
          </p>
        )}
        <Input
          label={t('pickupDate')}
          type="date"
          min={today}
          {...register('pickup_date')}
          error={errors.pickup_date?.message}
          required
        />
        <Input
          label={t('expectedReturnDate')}
          type="date"
          min={today}
          {...register('expected_return_date')}
          error={errors.expected_return_date?.message}
          required
        />

        {estimatedTotal != null && (
          <div className="flex items-center justify-between p-3 bg-primary-subtle rounded-control">
            <span className="text-sm text-ink-muted">{t('estimatedTotal')}</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(estimatedTotal, locale)}</span>
          </div>
        )}

        <Textarea
          label={t('notes')}
          {...register('notes')}
          rows={3}
          placeholder={t('notesPlaceholder')}
          error={errors.notes?.message}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading} className="flex-1">
            {t('submit')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
