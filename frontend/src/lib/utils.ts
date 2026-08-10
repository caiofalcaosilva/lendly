import { clsx, type ClassValue } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { Category } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

const DATE_FNS_LOCALES = { pt: ptBR, en: enUS } as const
const DATE_PATTERNS = { pt: "dd 'de' MMM 'de' yyyy", en: 'MMM d, yyyy' } as const

export function formatDate(dateStr: string, locale: 'pt' | 'en' = 'pt') {
  return format(parseISO(dateStr), DATE_PATTERNS[locale], { locale: DATE_FNS_LOCALES[locale] })
}

// Currency stays BRL regardless of locale (a local marketplace, no FX
// conversion) — only the number formatting (separators, symbol position)
// follows the active locale.
export function formatCurrency(value: number, locale: 'pt' | 'en' = 'pt') {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// `categories` comes from categoriesService.list() (GET /categories) —
// callers fetch it once and pass it in, since the valid set is now
// admin-editable rather than a bundled const. Falls back to the raw key
// if categories haven't loaded yet or the key is unknown.
export function getCategoryLabel(categories: Category[], value: string) {
  return categories.find((c) => c.key === value)?.label ?? value
}

export function getSubcategoryLabel(categories: Category[], category: string, subcategory?: string | null) {
  if (!subcategory) return undefined
  return categories.find((c) => c.key === category)?.subcategories.find((s) => s.key === subcategory)?.label ?? subcategory
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

// Rejects absolute/protocol-relative URLs so a `?redirect=` query param
// can't send the user off-site (open redirect / phishing).
export function isSafeRedirect(path: string): boolean {
  return /^\/(?!\/)/.test(path)
}

// Only http(s) URLs are safe to render as a clickable href — blocks
// javascript:/data: URIs a user could set as their profile website.
export function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
