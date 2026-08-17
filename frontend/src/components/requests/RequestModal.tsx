'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { requestsService } from '@/services/requests'
import { itemsService } from '@/services/items'
import { Item } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { calculateRentalPrice, GUARANTEE_FEE_PERCENT } from '@/lib/pricing'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Radio from '@/components/ui/Radio'

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

// JS Date#getDay() is 0=domingo...6=sábado; the backend uses Python's
// weekday() convention, 0=segunda...6=domingo. Converting once here keeps
// every other comparison in this file in the backend's terms.
const toBackendWeekday = (dateStr: string) => (new Date(dateStr).getUTCDay() + 6) % 7

function buildSchema(
  availableDays: number[],
  fulfillmentChoiceRequired: boolean,
  maxQuantity: number,
  t: ReturnType<typeof useTranslations>,
) {
  return z
    .object({
      pickup_date: z.string().min(1, t('errors.pickupDateRequired')),
      expected_return_date: z.string().min(1, t('errors.returnDateRequired')),
      fulfillment_method: z.enum(['pickup', 'delivery']).optional(),
      quantity: z.number().int().min(1).max(maxQuantity, t('errors.quantityUnavailable')),
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
  const quantityTotal = item.quantity_total ?? 1
  const hasMultipleUnits = quantityTotal > 1
  const [availableUnits, setAvailableUnits] = useState<number | null>(null)
  const maxQuantity = hasMultipleUnits ? availableUnits ?? quantityTotal : 1
  const schema = buildSchema(availableDays, fulfillmentChoiceRequired, maxQuantity, t)
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { quantity: 1 } })

  const today = new Date().toISOString().split('T')[0]

  const pickupDate = watch('pickup_date')
  const returnDate = watch('expected_return_date')
  const quantity = watch('quantity') || 1
  const selectedFulfillment = watch('fulfillment_method')
  const effectiveFulfillment = fulfillmentChoiceRequired ? selectedFulfillment : fulfillmentOptions[0]

  useEffect(() => {
    if (!hasMultipleUnits || !pickupDate || !returnDate) {
      setAvailableUnits(null)
      return
    }
    let cancelled = false
    itemsService
      .checkAvailability(item.id, new Date(pickupDate).toISOString(), new Date(returnDate).toISOString())
      .then((res) => {
        if (!cancelled) setAvailableUnits(res.available_units)
      })
      .catch(() => {
        if (!cancelled) setAvailableUnits(null)
      })
    return () => {
      cancelled = true
    }
  }, [hasMultipleUnits, item.id, pickupDate, returnDate])

  const priceBreakdown = (() => {
    if (item.availability_type !== 'paid' || !pickupDate || !returnDate) return null
    const days = Math.round(
      (new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86_400_000,
    )
    if (days <= 0) return null
    const base = calculateRentalPrice(item, days)
    if (base == null) return null
    const rental = Math.round(base * quantity * 100) / 100
    const delivery = effectiveFulfillment === 'delivery' ? item.delivery_fee ?? 0 : 0
    const guarantee = item.has_declared_value
      ? Math.round((rental + delivery) * GUARANTEE_FEE_PERCENT * 100) / 100
      : 0
    const total = Math.round((rental + delivery + guarantee) * 100) / 100
    return { rental, delivery, guarantee, total }
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
        quantity: hasMultipleUnits ? data.quantity : undefined,
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
                <Radio
                  key={val}
                  checked={selectedFulfillment === val}
                  onChange={() => setValue('fulfillment_method', val, { shouldValidate: true })}
                  label={val === 'pickup' ? t('fulfillmentPickup') : t('fulfillmentDelivery')}
                />
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

        {hasMultipleUnits && (
          <Input
            label={t('quantity')}
            type="number"
            min="1"
            max={maxQuantity}
            step="1"
            {...register('quantity', { valueAsNumber: true })}
            error={errors.quantity?.message}
            helper={
              pickupDate && returnDate
                ? availableUnits != null
                  ? t('unitsAvailable', { count: availableUnits })
                  : undefined
                : t('unitsAvailableTotal', { count: quantityTotal })
            }
            required
          />
        )}

        {priceBreakdown != null && (
          <div className="p-3 bg-primary-subtle rounded-control space-y-1.5">
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>{t('rentalSubtotal')}</span>
              <span className="font-mono tabular-nums">{formatCurrency(priceBreakdown.rental, locale)}</span>
            </div>
            {priceBreakdown.delivery > 0 && (
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>{t('deliveryFeeLine')}</span>
                <span className="font-mono tabular-nums">{formatCurrency(priceBreakdown.delivery, locale)}</span>
              </div>
            )}
            {priceBreakdown.guarantee > 0 && (
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>{t('guaranteeFeeLine')}</span>
                <span className="font-mono tabular-nums">{formatCurrency(priceBreakdown.guarantee, locale)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-primary/20">
              <span className="text-sm text-ink-muted">{t('estimatedTotal')}</span>
              <span className="text-lg font-bold font-mono tabular-nums text-primary">{formatCurrency(priceBreakdown.total, locale)}</span>
            </div>
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
