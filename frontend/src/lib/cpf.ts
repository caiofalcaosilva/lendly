function checkDigit(digits: number[], weights: number[]): number {
  const total = digits.reduce((sum, d, i) => sum + d * weights[i], 0)
  const remainder = total % 11
  return remainder < 2 ? 0 : 11 - remainder
}

// Same mod-11 weighted-sum algorithm as web/app/utils/validators.py — kept
// in sync so the form can reject an invalid CPF before any round-trip.
export function isValidCpf(value: string): boolean {
  const digitsStr = (value || '').replace(/\D/g, '')
  if (digitsStr.length !== 11 || /^(\d)\1{10}$/.test(digitsStr)) return false

  const digits = digitsStr.split('').map(Number)
  const weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]

  if (checkDigit(digits.slice(0, 9), weights1) !== digits[9]) return false
  if (checkDigit(digits.slice(0, 10), weights2) !== digits[10]) return false
  return true
}

export function formatCpf(value: string): string {
  const d = (value || '').replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}
