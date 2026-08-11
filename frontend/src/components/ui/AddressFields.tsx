'use client'
import { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { useCepLookup, BR_STATES } from '@/lib/useCepLookup'
import CepField from './CepField'
import Input from './Input'
import Select from './Select'

interface Props {
  control: Control<any>
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  errors: FieldErrors<any>
}

export default function AddressFields({ control, register, setValue, errors }: Props) {
  const { status, lookup } = useCepLookup(setValue, true)
  const t = useTranslations('Common.AddressFields')

  const errMsg = (field: string) => {
    const e = (errors as any)[field]
    return e?.message ? String(e.message) : undefined
  }

  return (
    <div className="space-y-4">
      <CepField
        control={control}
        status={status}
        onBlurLookup={lookup}
        label={t('zipCode')}
        required
        placeholder="00000-000"
        error={errMsg('zip_code')}
        autoFilledText={t('autoFilled')}
        notFoundText={t('zipNotFound')}
        errorText={t('zipError')}
      />

      {/* Street + Number */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3">
          <Input
            label={t('street')}
            {...register('street')}
            placeholder={t('streetPlaceholder')}
            error={errMsg('street')}
          />
        </div>
        <Input
          label={t('number')}
          {...register('number')}
          placeholder="123"
          error={errMsg('number')}
        />
      </div>

      {/* Complement */}
      <Input
        label={t('complement')}
        {...register('complement')}
        placeholder={t('complementPlaceholder')}
        error={errMsg('complement')}
      />

      {/* Neighborhood + State */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label={t('neighborhood')}
            {...register('neighborhood')}
            placeholder="Vila Madalena"
            error={errMsg('neighborhood')}
          />
        </div>
        <Select label={t('state')} {...register('state')} error={errMsg('state')}>
          <option value="">{t('stateAbbrev')}</option>
          {BR_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {/* City */}
      <Input
        label={t('city')}
        {...register('city')}
        placeholder="São Paulo"
        error={errMsg('city')}
      />
    </div>
  )
}
