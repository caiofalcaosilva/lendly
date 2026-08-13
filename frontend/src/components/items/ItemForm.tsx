'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { MapPin, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Category, Item, GroupSummary } from '@/types'
import { itemsService } from '@/services/items'
import { groupsService } from '@/services/groups'
import { categoriesService } from '@/services/categories'
import { paymentsService } from '@/services/payments'
import { configService } from '@/services/config'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import LocationFields from '@/components/ui/LocationFields'
import ItemPhotoUploader from '@/components/items/ItemPhotoUploader'
import ItemPhotoPicker from '@/components/items/ItemPhotoPicker'

type AddressMode = 'default' | 'custom'

function formatAddressSummary(a: { neighborhood?: string; city?: string; state?: string; zip_code?: string }) {
  const parts = [
    a.neighborhood,
    a.city && a.state ? `${a.city} - ${a.state}` : a.city ?? a.state,
    a.zip_code,
  ].filter(Boolean)
  return parts.join(' · ')
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const FULFILLMENT_OPTIONS = ['pickup', 'delivery'] as const
type FulfillmentOption = (typeof FULFILLMENT_OPTIONS)[number]

function sameAddress(a: { zip_code?: string; neighborhood?: string; city?: string; state?: string }, b: { zip_code?: string; neighborhood?: string; city?: string; state?: string }) {
  return (a.zip_code || '') === (b.zip_code || '')
    && (a.neighborhood || '') === (b.neighborhood || '')
    && (a.city || '') === (b.city || '')
    && (a.state || '') === (b.state || '')
}

export default function ItemForm({ item }: { item?: Item }) {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('Common.ItemForm')
  const [photos, setPhotos] = useState<string[]>(item?.photos ?? [])
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [myGroups, setMyGroups] = useState<GroupSummary[]>([])
  const [groupSearch, setGroupSearch] = useState('')
  const [isPublic, setIsPublic] = useState(item?.is_public ?? true)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(item?.groups ?? [])
  const [selectedDays, setSelectedDays] = useState<number[]>(item?.available_days ?? [])
  const [fulfillmentOptions, setFulfillmentOptions] = useState<FulfillmentOption[]>(
    item?.fulfillment_options ?? ['pickup'],
  )
  const [requiresVerification, setRequiresVerification] = useState(item?.requires_identity_verification ?? false)
  const [addressMode, setAddressMode] = useState<AddressMode>('custom')
  const [addressModeInitialized, setAddressModeInitialized] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [mpConnected, setMpConnected] = useState(true)
  const [freeLendingOnly, setFreeLendingOnly] = useState(false)
  const hasProfileAddress = !!user?.zip_code

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    paymentsService.getMercadoPagoStatus().then((s) => setMpConnected(s.connected))
  }, [])

  useEffect(() => {
    configService.get().then((c) => setFreeLendingOnly(c.free_lending_only))
  }, [])

  // Admin accounts can't own items — bounce them away rather than let them
  // fill out a form the backend will reject on submit.
  useEffect(() => {
    if (user?.is_admin) {
      router.push('/admin/dashboard')
    }
  }, [user, router])

  // Runs once, as soon as the profile (and, in edit mode, the item) are
  // available — picks the sensible starting tab without fighting the
  // user's own toggle on later re-renders.
  useEffect(() => {
    if (addressModeInitialized || !user) return
    if (!user.zip_code) {
      setAddressMode('custom')
    } else if (item) {
      setAddressMode(sameAddress(item, user) ? 'default' : 'custom')
    } else {
      setAddressMode('default')
    }
    setAddressModeInitialized(true)
  }, [user, item, addressModeInitialized])

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const toggleFulfillment = (option: FulfillmentOption) => {
    setFulfillmentOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    )
  }

  useEffect(() => {
    groupsService.mine({ limit: 200 }).then(setMyGroups).catch(() => {})
  }, [])

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  const schema = z
    .object({
      title: z.string().min(3, t('errors.minTitle')).max(100),
      description: z.string().max(1000).optional(),
      category: z.string().min(1, t('errors.selectCategory')),
      subcategory: z.string().optional().or(z.literal('')),
      availability_type: z.enum(['free', 'paid']),
      daily_rate: z.number({ invalid_type_error: t('errors.enterValue') }).min(0.01).optional().nullable(),
      weekly_rate: z.number().min(0.01).optional().nullable(),
      monthly_rate: z.number().min(0.01).optional().nullable(),
      delivery_fee: z.number().min(0).optional().nullable(),
      usage_rules: z.string().max(500).optional(),
      zip_code: z.string().max(9).optional().or(z.literal('')),
      neighborhood: z.string().max(100).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(2).optional().or(z.literal('')),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .refine(
      (d) => d.availability_type === 'free' || (d.daily_rate != null && d.daily_rate > 0),
      { message: t('errors.dailyRateRequired'), path: ['daily_rate'] },
    )

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          title: item.title,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory ?? '',
          availability_type: item.availability_type,
          daily_rate: item.daily_rate,
          weekly_rate: item.weekly_rate,
          monthly_rate: item.monthly_rate,
          delivery_fee: item.delivery_fee,
          usage_rules: item.usage_rules,
          zip_code: (item as any).zip_code ?? '',
          neighborhood: item.neighborhood,
          city: item.city,
          state: (item as any).state ?? '',
        }
      : { availability_type: 'free' },
  })

  const availType = watch('availability_type')
  const category = watch('category')
  const subcategoryOptions = category ? categories.find((c) => c.key === category)?.subcategories ?? [] : []

  // If paid rentals are off platform-wide, always present the form as free —
  // covers editing an item that was set to paid before the switch flipped.
  useEffect(() => {
    if (freeLendingOnly) setValue('availability_type', 'free')
  }, [freeLendingOnly, setValue])

  // Clear the subcategory whenever it no longer belongs to the selected
  // category (e.g. user picked a category, then changed their mind).
  useEffect(() => {
    const current = watch('subcategory')
    if (current && !subcategoryOptions.some((s) => s.key === current)) {
      setValue('subcategory', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const onSubmit = async (data: FormData) => {
    if (myGroups.length > 0 && !isPublic && selectedGroupIds.length === 0) {
      setError(t('errors.visibilityRequired'))
      return
    }
    if (fulfillmentOptions.length === 0) {
      setError(t('errors.fulfillmentRequired'))
      return
    }
    if (data.availability_type === 'paid' && !mpConnected) {
      setError(t('errors.connectMercadoPago'))
      return
    }
    setLoading(true)
    setError('')
    // In "usar meu endereço padrão" mode the location fields aren't shown
    // (or edited) at all — the profile's own address is what gets saved,
    // same as picking it manually in "outro endereço".
    const addressOverride = addressMode === 'default' && user
      ? {
          zip_code: user.zip_code,
          neighborhood: user.neighborhood,
          city: user.city,
          state: user.state,
          latitude: user.latitude,
          longitude: user.longitude,
        }
      : {}
    const payload = {
      ...data,
      subcategory: data.subcategory || undefined,
      is_public: isPublic,
      group_ids: selectedGroupIds,
      available_days: selectedDays,
      requires_identity_verification: requiresVerification,
      fulfillment_options: fulfillmentOptions,
      ...addressOverride,
    }
    try {
      if (item) {
        await itemsService.update(item.id, { ...payload, photos })
        router.push('/dashboard')
      } else {
        // The upload endpoint needs a real item id, which only exists after
        // creation — so the item is created first (without photos), then
        // every staged file is uploaded right after, all within this same
        // submit. The user only sees one step: pick photos, click once.
        const created = await itemsService.create({ ...payload, photos: [] } as any)
        for (const file of stagedFiles) {
          try {
            await itemsService.uploadPhoto(created.id, file)
          } catch {
            // Item already exists at this point — don't block navigation
            // over one failed photo, the user can retry from the edit page.
          }
        }
        router.push('/dashboard')
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errors.saveError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && <div className="p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">{error}</div>}

      <Input label={t('title')} {...register('title')} error={errors.title?.message} placeholder="Ex: Furadeira Bosch 650W" required />

      <Textarea
        label={t('description')}
        {...register('description')}
        rows={3}
        placeholder={t('descriptionPlaceholder')}
      />

      <Select
        label={t('category')}
        required
        {...register('category')}
        error={errors.category?.message}
      >
        <option value="">{t('select')}</option>
        {categories.map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </Select>

      {subcategoryOptions.length > 0 && (
        <Select label={t('subcategory')} {...register('subcategory')}>
          <option value="">{t('none')}</option>
          {subcategoryOptions.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </Select>
      )}

      {item ? (
        <ItemPhotoUploader itemId={item.id} photos={photos} onChange={setPhotos} />
      ) : (
        <ItemPhotoPicker files={stagedFiles} onChange={setStagedFiles} />
      )}

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">{t('availabilityType')}</label>
        <div className="flex gap-6">
          {(freeLendingOnly ? (['free'] as const) : (['free', 'paid'] as const)).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-ink">
              <input type="radio" value={val} {...register('availability_type')} className="text-primary" />
              <span className="text-sm">{val === 'free' ? t('freeLoan') : t('paidRental')}</span>
            </label>
          ))}
        </div>
        {freeLendingOnly && (
          <p className="text-xs text-ink-subtle mt-1.5">{t('freeLendingOnlyNotice')}</p>
        )}
      </div>

      {availType === 'paid' && !mpConnected && (
        <div className="flex items-start gap-2 bg-warning-subtle border border-warning/30 rounded-control p-3 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {t('connectMercadoPagoNotice')}{' '}
            <Link href="/profile" className="underline font-medium">{t('connectNow')}</Link>
          </span>
        </div>
      )}

      {availType === 'paid' && (
        <div>
          <Input
            label={t('dailyRate')}
            type="number"
            step="0.01"
            min="0.01"
            {...register('daily_rate', { valueAsNumber: true })}
            error={errors.daily_rate?.message}
            placeholder="0,00"
            required
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input
              label={t('weeklyRate')}
              type="number"
              step="0.01"
              min="0.01"
              {...register('weekly_rate', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
              error={errors.weekly_rate?.message}
              placeholder="0,00"
            />
            <Input
              label={t('monthlyRate')}
              type="number"
              step="0.01"
              min="0.01"
              {...register('monthly_rate', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
              error={errors.monthly_rate?.message}
              placeholder="0,00"
            />
          </div>
          <p className="text-xs text-ink-subtle mt-1.5">{t('tieredRateHint')}</p>

          {fulfillmentOptions.includes('delivery') && (
            <div className="mt-3">
              <Input
                label={t('deliveryFee')}
                type="number"
                step="0.01"
                min="0"
                {...register('delivery_fee', {
                  setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
                })}
                error={errors.delivery_fee?.message}
                placeholder="0,00"
              />
              <p className="text-xs text-ink-subtle mt-1.5">{t('deliveryFeeHint')}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">
          {t('availableDays')}
          <span className="text-xs font-normal text-ink-subtle ml-2">
            {t('availableDaysHint')}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_KEYS.map((key, value) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(value)}
              className={`px-3 py-1.5 rounded-control text-sm border transition-colors ${
                selectedDays.includes(value)
                  ? 'bg-primary border-primary text-primary-on'
                  : 'bg-surface border-border text-ink-muted'
              }`}
            >
              {t(`weekdays.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">
          {t('fulfillmentOptions')}
          <span className="text-xs font-normal text-ink-subtle ml-2">
            {t('fulfillmentOptionsHint')}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {FULFILLMENT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleFulfillment(option)}
              className={`px-3 py-1.5 rounded-control text-sm border transition-colors ${
                fulfillmentOptions.includes(option)
                  ? 'bg-primary border-primary text-primary-on'
                  : 'bg-surface border-border text-ink-muted'
              }`}
            >
              {option === 'pickup' ? t('fulfillmentPickup') : t('fulfillmentDelivery')}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-ink">
        <input
          type="checkbox"
          checked={requiresVerification}
          onChange={(e) => setRequiresVerification(e.target.checked)}
          className="text-primary rounded"
        />
        <span className="text-sm">{t('requireVerification')}</span>
      </label>

      <Textarea
        label={t('usageRules')}
        {...register('usage_rules')}
        rows={2}
        placeholder={t('usageRulesPlaceholder')}
      />

      {myGroups.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium text-ink-muted mb-3">{t('visibility')}</p>
          <label className="flex items-center gap-2 cursor-pointer mb-2 text-ink">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="text-primary rounded"
            />
            <span className="text-sm">{t('visibleInPublicSearch')}</span>
          </label>
          <p className="text-xs text-ink-subtle mb-2">{t('alsoShareInGroups')}</p>
          {myGroups.length > 8 && (
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder={t('searchGroupsPlaceholder')}
              className="w-full mb-2 px-3 py-1.5 bg-surface text-ink border border-border rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {myGroups
              .filter((g) => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()))
              .map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer text-ink">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="text-primary rounded"
                  />
                  <span className="text-sm">{g.name}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <p className="text-sm font-medium text-ink-muted mb-3">
          {t('itemLocation')}
          {addressMode === 'custom' && (
            <span className="text-xs font-normal text-ink-subtle ml-2">
              {t('itemLocationHint')}
            </span>
          )}
        </p>

        {hasProfileAddress && (
          <div className="mb-4">
            <Select
              label={t('itemAddress')}
              value={addressMode}
              onChange={(e) => setAddressMode(e.target.value as AddressMode)}
            >
              <option value="default">{t('useDefaultAddress')}</option>
              <option value="custom">{t('otherAddress')}</option>
            </Select>
          </div>
        )}

        {addressMode === 'default' && user ? (
          <div className="flex items-start gap-2 p-3 bg-surface-2 rounded-control text-sm text-ink-muted">
            <MapPin className="w-4 h-4 text-ink-subtle flex-shrink-0 mt-0.5" />
            <span>{formatAddressSummary(user) || t('profileAddress')}</span>
          </div>
        ) : (
          <LocationFields
            control={control as any}
            register={register}
            setValue={setValue as any}
            errors={errors}
          />
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          {item ? t('saveChanges') : t('createItem')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}
