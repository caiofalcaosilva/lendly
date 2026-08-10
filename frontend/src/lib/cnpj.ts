function checkDigit(digits: number[], weights: number[]): number {
  const total = digits.reduce((sum, d, i) => sum + d * weights[i], 0)
  const remainder = total % 11
  return remainder < 2 ? 0 : 11 - remainder
}

// Same mod-11 weighted-sum algorithm as web/app/utils/validators.py — kept
// in sync so the form can reject an invalid CNPJ before any round-trip.
export function isValidCnpj(value: string): boolean {
  const digitsStr = (value || '').replace(/\D/g, '')
  if (digitsStr.length !== 14 || /^(\d)\1{13}$/.test(digitsStr)) return false

  const digits = digitsStr.split('').map(Number)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  if (checkDigit(digits.slice(0, 12), weights1) !== digits[12]) return false
  if (checkDigit(digits.slice(0, 13), weights2) !== digits[13]) return false
  return true
}

export function formatCnpj(value: string): string {
  const d = (value || '').replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export interface CnpjLookupResult {
  companyName?: string
  tradeName?: string
}

// Hits BrasilAPI directly from the browser — same pattern already used for
// CEP lookups in AddressFields.tsx/LocationFields.tsx, no backend proxy.
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult | null> {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
    if (!r.ok) return null
    const data = await r.json()
    return {
      companyName: data?.razao_social || undefined,
      tradeName: data?.nome_fantasia || undefined,
    }
  } catch {
    return null
  }
}
