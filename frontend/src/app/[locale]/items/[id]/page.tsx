import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Category } from '@/types'
import { getCategoryLabel, formatCurrency } from '@/lib/utils'
import ItemDetailClient from './ItemDetailClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchItemForMetadata(id: string) {
  try {
    const res = await fetch(`${API_URL}/items/${id}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; locale: string }
}): Promise<Metadata> {
  const locale = params.locale
  const t = await getTranslations({ locale, namespace: 'Items.Id' })
  const [item, categories] = await Promise.all([fetchItemForMetadata(params.id), fetchCategories()])
  if (!item) {
    return { title: t('metaNotFoundTitle') }
  }

  const priceLine = item.availability_type === 'free'
    ? t('free')
    : `${formatCurrency(item.daily_rate ?? 0, locale as 'pt' | 'en')}${t('perDay')}`
  const description = item.description?.trim() || t('metaFallbackDescription', { price: priceLine, category: getCategoryLabel(categories, item.category) })
  const photo = item.photos?.[0]

  return {
    title: `${item.title} | Lendly`,
    description,
    openGraph: {
      title: item.title,
      description,
      url: `/items/${params.id}`,
      siteName: 'Lendly',
      locale: locale === 'en' ? 'en_US' : 'pt_BR',
      type: 'website',
      ...(photo ? { images: [{ url: photo }] } : {}),
    },
    twitter: {
      card: photo ? 'summary_large_image' : 'summary',
      title: item.title,
      description,
      ...(photo ? { images: [photo] } : {}),
    },
  }
}

export default function ItemDetailPage() {
  return <ItemDetailClient />
}
