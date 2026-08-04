'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, AlertTriangle } from 'lucide-react'
import { Category, Item, GroupSummary } from '@/types'
import { itemsService } from '@/services/items'
import { groupsService } from '@/services/groups'
import { categoriesService } from '@/services/categories'
import { paymentsService } from '@/services/payments'
import { useAuth } from '@/contexts/AuthContext'
import Input from '@/components/ui/Input'
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

const WEEKDAYS = [
  { value: 0, label: 'Seg' },
  { value: 1, label: 'Ter' },
  { value: 2, label: 'Qua' },
  { value: 3, label: 'Qui' },
  { value: 4, label: 'Sex' },
  { value: 5, label: 'Sáb' },
  { value: 6, label: 'Dom' },
]

const schema = z
  .object({
    title: z.string().min(3, 'Mínimo 3 caracteres').max(100),
    description: z.string().max(1000).optional(),
    category: z.string().min(1, 'Selecione uma categoria'),
    subcategory: z.string().optional().or(z.literal('')),
    availability_type: z.enum(['free', 'paid']),
    daily_rate: z.number({ invalid_type_error: 'Informe o valor' }).min(0.01).optional().nullable(),
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
    { message: 'Informe o valor diário para itens pagos', path: ['daily_rate'] },
  )

type FormData = z.infer<typeof schema>

function sameAddress(a: { zip_code?: string; neighborhood?: string; city?: string; state?: string }, b: { zip_code?: string; neighborhood?: string; city?: string; state?: string }) {
  return (a.zip_code || '') === (b.zip_code || '')
    && (a.neighborhood || '') === (b.neighborhood || '')
    && (a.city || '') === (b.city || '')
    && (a.state || '') === (b.state || '')
}

export default function ItemForm({ item }: { item?: Item }) {
  const router = useRouter()
  const { user } = useAuth()
  const [photos, setPhotos] = useState<string[]>(item?.photos ?? [])
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [myGroups, setMyGroups] = useState<GroupSummary[]>([])
  const [isPublic, setIsPublic] = useState(item?.is_public ?? true)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(item?.groups ?? [])
  const [selectedDays, setSelectedDays] = useState<number[]>(item?.available_days ?? [])
  const [requiresVerification, setRequiresVerification] = useState(item?.requires_identity_verification ?? false)
  const [addressMode, setAddressMode] = useState<AddressMode>('custom')
  const [addressModeInitialized, setAddressModeInitialized] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [mpConnected, setMpConnected] = useState(true)
  const hasProfileAddress = !!user?.zip_code

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    paymentsService.getMercadoPagoStatus().then((s) => setMpConnected(s.connected))
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

  useEffect(() => {
    groupsService.mine().then(setMyGroups).catch(() => {})
  }, [])

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

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
      setError('Escolha ao menos "visível na busca pública" ou um grupo pra compartilhar.')
      return
    }
    if (data.availability_type === 'paid' && !mpConnected) {
      setError('Conecte sua conta Mercado Pago antes de anunciar um item pago.')
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
      setError(e.response?.data?.detail || 'Erro ao salvar item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

      <Input label="Título" {...register('title')} error={errors.title?.message} placeholder="Ex: Furadeira Bosch 650W" required />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Estado de conservação, acessórios incluídos, etc."
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Categoria <span className="text-red-500">*</span>
        </label>
        <select
          {...register('category')}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Selecione...</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        {errors.category && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.category.message}</p>}
      </div>

      {subcategoryOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategoria</label>
          <select
            {...register('subcategory')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Nenhuma</option>
            {subcategoryOptions.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {item ? (
        <ItemPhotoUploader itemId={item.id} photos={photos} onChange={setPhotos} />
      ) : (
        <ItemPhotoPicker files={stagedFiles} onChange={setStagedFiles} />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de disponibilidade</label>
        <div className="flex gap-6">
          {(['free', 'paid'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
              <input type="radio" value={val} {...register('availability_type')} className="text-green-600" />
              <span className="text-sm">{val === 'free' ? 'Gratuito (empréstimo)' : 'Pago (aluguel)'}</span>
            </label>
          ))}
        </div>
      </div>

      {availType === 'paid' && !mpConnected && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Conecte sua conta Mercado Pago antes de anunciar um item pago.{' '}
            <Link href="/profile" className="underline font-medium">Conectar agora</Link>
          </span>
        </div>
      )}

      {availType === 'paid' && (
        <Input
          label="Valor diário (R$)"
          type="number"
          step="0.01"
          min="0.01"
          {...register('daily_rate', { valueAsNumber: true })}
          error={errors.daily_rate?.message}
          placeholder="0,00"
          required
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Disponível em quais dias da semana
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-2">
            — deixe todos desmarcados para disponibilizar todo dia
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                selectedDays.includes(d.value)
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
        <input
          type="checkbox"
          checked={requiresVerification}
          onChange={(e) => setRequiresVerification(e.target.checked)}
          className="text-green-600 rounded"
        />
        <span className="text-sm">Exigir verificação de identidade pra emprestar</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regras de uso</label>
        <textarea
          {...register('usage_rules')}
          rows={2}
          placeholder="Ex: Devolver limpo, não usar para fins comerciais..."
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {myGroups.length > 0 && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Visibilidade</p>
          <label className="flex items-center gap-2 cursor-pointer mb-2 text-gray-900 dark:text-gray-100">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="text-green-600 rounded"
            />
            <span className="text-sm">Visível na busca pública</span>
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Também compartilhar nestes grupos:</p>
          <div className="space-y-1.5">
            {myGroups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  className="text-green-600 rounded"
                />
                <span className="text-sm">{g.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Localização do item
          {addressMode === 'custom' && (
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-2">
              — informe o CEP para preencher automaticamente
            </span>
          )}
        </p>

        {hasProfileAddress && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço do item</label>
            <select
              value={addressMode}
              onChange={(e) => setAddressMode(e.target.value as AddressMode)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="default">Usar meu endereço padrão</option>
              <option value="custom">Outro endereço</option>
            </select>
          </div>
        )}

        {addressMode === 'default' && user ? (
          <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <span>{formatAddressSummary(user) || 'Endereço do seu perfil'}</span>
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
          {item ? 'Salvar alterações' : 'Cadastrar item'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
