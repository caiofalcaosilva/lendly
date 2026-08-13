import { useCallback, useState } from 'react'
import { UseFormSetValue } from 'react-hook-form'
import { resolveCoordinates } from '@/lib/geocode'

export type CepStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// Shared by AddressFields (full street address, used for the user's own
// profile) and LocationFields (neighborhood-level only, used for an item's
// public location — no street/number collected there on purpose).
export function useCepLookup(setValue: UseFormSetValue<any>, includeStreet: boolean) {
  const [status, setStatus] = useState<CepStatus>('idle')
  // Separate from `status` — the address fields land as soon as ViaCEP
  // resolves, but the coordinate (Nominatim, then BrasilAPI as a fallback)
  // can take a few seconds longer, and that's exactly the gap during which
  // the map picker either isn't showing yet or is still centered on the
  // previous point.
  const [locating, setLocating] = useState(false)

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
        if (includeStreet && data.logradouro) setValue('street', data.logradouro, { shouldDirty: true })
        if (data.bairro) setValue('neighborhood', data.bairro, { shouldDirty: true })
        if (data.localidade) setValue('city', data.localidade, { shouldDirty: true })
        if (data.uf) setValue('state', data.uf, { shouldDirty: true })
        setStatus('found')

        setLocating(true)
        resolveCoordinates(digits, data.bairro, data.localidade, data.uf)
          .then((coords) => {
            if (coords) {
              setValue('latitude', coords.latitude, { shouldDirty: true })
              setValue('longitude', coords.longitude, { shouldDirty: true })
            }
          })
          .finally(() => setLocating(false))
      } catch {
        setStatus('error')
      }
    },
    [setValue, includeStreet],
  )

  return { status, locating, lookup }
}
