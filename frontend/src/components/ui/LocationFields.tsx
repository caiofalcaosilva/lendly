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

// Neighborhood-level location for an item's listing — deliberately lighter
// than AddressFields (no street/number), since an item's public location
// only needs to be precise to the neighborhood.
export default function LocationFields({ control, register, setValue, errors }: Props) {
  const { status, lookup } = useCepLookup(setValue, false)
  const t = useTranslations('Common.LocationFields')

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
        placeholder={t('zipCodePlaceholder')}
        error={errMsg('zip_code')}
        autoFilledText={t('autoFilled')}
        notFoundText={t('zipNotFound')}
        errorText={t('zipError')}
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
        <Select label={t('state')} {...register('state')}>
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
