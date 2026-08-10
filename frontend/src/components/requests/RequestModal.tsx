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
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

// JS Date#getDay() is 0=domingo...6=sábado; the backend uses Python's
// weekday() convention, 0=segunda...6=domingo. Converting once here keeps
// every other comparison in this file in the backend's terms.
const toBackendWeekday = (dateStr: string) => (new Date(dateStr).getUTCDay() + 6) % 7

function buildSchema(availableDays: number[], t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      pickup_date: z.string().min(1, t('errors.pickupDateRequired')),
      expected_return_date: z.string().min(1, t('errors.returnDateRequired')),
      notes: z.string().max(500).optional(),
    })
    .refine((d) => d.pickup_date < d.expected_return_date, {
      message: t('errors.returnAfterPickup'),
      path: ['expected_return_date'],
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
  const schema = buildSchema(availableDays, t)
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const today = new Date().toISOString().split('T')[0]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await requestsService.create({
        item_id: item.id,
        pickup_date: new Date(data.pickup_date).toISOString(),
        expected_return_date: new Date(data.expected_return_date).toISOString(),
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
      <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
        <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {item.availability_type === 'free'
            ? t('freeLoan')
            : t('paidRental', { price: formatCurrency(item.daily_rate ?? 0, locale) })}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('owner', { name: item.owner.name })}</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {availableDays.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes')}</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder={t('notesPlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.notes && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.notes.message}</p>}
        </div>

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
