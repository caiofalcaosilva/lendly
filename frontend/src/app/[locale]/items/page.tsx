import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Category, Item } from '@/types'
import { getCategoryLabel, getSubcategoryLabel } from '@/lib/utils'
import ItemsClient from './ItemsClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface SearchParams {
  search?: string
  category?: string
  subcategory?: string
  availability_type?: string
  neighborhood?: string
  city?: string
}

async function fetchInitialItems(params: SearchParams): Promise<Item[]> {
  const query = new URLSearchParams({ limit: '16' })
  if (params.search) query.set('search', params.search)
  if (params.category) query.set('category', params.category)
  if (params.subcategory) query.set('subcategory', params.subcategory)
  if (params.availability_type) query.set('availability_type', params.availability_type)
  if (params.neighborhood) query.set('neighborhood', params.neighborhood)
  if (params.city) query.set('city', params.city)

  try {
    const res = await fetch(`${API_URL}/items/?${query.toString()}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// Categories are admin-editable now, so metadata labels can't come from a
// bundled const — cached longer than item data since they change rarely.
async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function generateMetadata({ searchParams, params: { locale } }: { searchParams: SearchParams; params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Items.meta' })
  const categories = await fetchCategories()
  const categoryLabel = searchParams.category ? getCategoryLabel(categories, searchParams.category) : undefined
  const subcategoryLabel = searchParams.category
    ? getSubcategoryLabel(categories, searchParams.category, searchParams.subcategory)
    : undefined

  let title = t('defaultTitle')
  let description = t('defaultDescription')

  if (searchParams.search) {
    title = t('searchTitle', { search: searchParams.search })
    description = t('searchDescription', { search: searchParams.search })
  } else if (subcategoryLabel && categoryLabel) {
    title = t('subcategoryTitle', { subcategory: subcategoryLabel, category: categoryLabel })
    description = t('subcategoryDescription', { subcategory: subcategoryLabel.toLowerCase(), category: categoryLabel.toLowerCase() })
  } else if (categoryLabel) {
    title = t('categoryTitle', { category: categoryLabel })
    description = t('categoryDescription', { category: categoryLabel.toLowerCase() })
  }

  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Lendly', locale: locale === 'en' ? 'en_US' : 'pt_BR', type: 'website' },
  }
}

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const initialItems = await fetchInitialItems(searchParams)

  return (
    <ItemsClient
      initialItems={initialItems}
      initialFilters={{
        search: searchParams.search ?? '',
        category: searchParams.category ?? '',
        subcategory: searchParams.subcategory ?? '',
        availability_type: searchParams.availability_type ?? '',
        neighborhood: searchParams.neighborhood ?? '',
        city: searchParams.city ?? '',
      }}
    />
  )
}
