'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Item, CATEGORIES } from '@/types'
import { itemsService } from '@/services/items'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import LocationFields from '@/components/ui/LocationFields'

const schema = z
  .object({
    title: z.string().min(3, 'Mínimo 3 caracteres').max(100),
    description: z.string().max(1000).optional(),
    category: z.enum(
      ['tools', 'electronics', 'sports', 'garden', 'kitchen', 'books', 'toys', 'clothing', 'furniture', 'other'],
      { required_error: 'Selecione uma categoria' },
    ),
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

export default function ItemForm({ item }: { item?: Item }) {
  const router = useRouter()
  const [photos, setPhotos] = useState<string[]>(item?.photos?.length ? item.photos : [''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const validPhotos = photos.filter((p) => p.trim())
      if (item) {
        await itemsService.update(item.id, { ...data, photos: validPhotos })
      } else {
        await itemsService.create({ ...data, photos: validPhotos } as any)
      }
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao salvar item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <Input label="Título" {...register('title')} error={errors.title?.message} placeholder="Ex: Furadeira Bosch 650W" required />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Estado de conservação, acessórios incluídos, etc."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categoria <span className="text-red-500">*</span>
        </label>
        <select
          {...register('category')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Selecione...</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fotos (URLs de imagens)</label>
        <div className="space-y-2">
          {photos.map((photo, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={photo}
                onChange={(e) => {
                  const next = [...photos]
                  next[i] = e.target.value
                  setPhotos(next)
                }}
                placeholder="https://exemplo.com/foto.jpg"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPhotos([...photos, ''])}
          className="mt-2 flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
        >
          <Plus className="w-4 h-4" /> Adicionar foto
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de disponibilidade</label>
        <div className="flex gap-6">
          {(['free', 'paid'] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value={val} {...register('availability_type')} className="text-green-600" />
              <span className="text-sm">{val === 'free' ? 'Gratuito (empréstimo)' : 'Pago (aluguel)'}</span>
            </label>
          ))}
        </div>
      </div>

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
        <label className="block text-sm font-medium text-gray-700 mb-1">Regras de uso</label>
        <textarea
          {...register('usage_rules')}
          rows={2}
          placeholder="Ex: Devolver limpo, não usar para fins comerciais..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Localização do item
          <span className="text-xs font-normal text-gray-400 ml-2">
            — informe o CEP para preencher automaticamente
          </span>
        </p>
        <LocationFields
          control={control as any}
          register={register}
          setValue={setValue as any}
          errors={errors}
        />
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
