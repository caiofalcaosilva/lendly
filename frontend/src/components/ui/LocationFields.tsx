'use client'
import { useState, useCallback } from 'react'
import { Control, Controller, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import Input from './Input'
import Spinner from './Spinner'

type CepStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

interface Props {
  control: Control<any>
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  errors: FieldErrors<any>
}

export default function LocationFields({ control, register, setValue, errors }: Props) {
  const [status, setStatus] = useState<CepStatus>('idle')

  const lookup = useCallback(
    async (raw: string) => {
      const digits = raw.replace(/\D/g, '')
      if (digits.length !== 8) return
      setStatus('loading')
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (data.erro) { setStatus('not_found'); return }
        if (data.bairro) setValue('neighborhood', data.bairro, { shouldDirty: true })
        if (data.localidade) setValue('city', data.localidade, { shouldDirty: true })
        if (data.uf) setValue('state', data.uf, { shouldDirty: true })
        setStatus('found')

        fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
          .then((r) => r.ok ? r.json() : null)
          .then((geo) => {
            const coords = geo?.location?.coordinates
            if (coords?.latitude && coords?.longitude) {
              setValue('latitude', parseFloat(coords.latitude), { shouldDirty: true })
              setValue('longitude', parseFloat(coords.longitude), { shouldDirty: true })
            }
          })
          .catch(() => {})
      } catch {
        setStatus('error')
      }
    },
    [setValue],
  )

  const errMsg = (field: string) => {
    const e = (errors as any)[field]
    return e?.message ? String(e.message) : undefined
  }

  return (
    <div className="space-y-4">
      {/* CEP */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
        <div className="relative">
          <Controller
            name="zip_code"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                placeholder="00000-000 (preenche os campos automaticamente)"
                maxLength={9}
                onChange={(e) => field.onChange(maskCEP(e.target.value))}
                onBlur={(e) => { field.onBlur(); lookup(e.target.value) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {status === 'idle'    && <Search className="w-4 h-4 text-gray-300" />}
            {status === 'loading' && <Spinner className="w-4 h-4 text-green-500" />}
            {status === 'found'   && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {(status === 'not_found' || status === 'error') && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
        {status === 'found' && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Localização preenchida automaticamente
          </p>
        )}
        {status === 'not_found' && (
          <p className="text-xs text-red-500 mt-1">CEP não encontrado. Preencha manualmente.</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-amber-600 mt-1">Erro ao consultar o CEP. Preencha manualmente.</p>
        )}
      </div>

      {/* Neighborhood + State */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label="Bairro"
            {...register('neighborhood')}
            placeholder="Vila Madalena"
            error={errMsg('neighborhood')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            {...register('state')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">UF</option>
            {BR_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* City */}
      <Input
        label="Cidade"
        {...register('city')}
        placeholder="São Paulo"
        error={errMsg('city')}
      />
    </div>
  )
}
