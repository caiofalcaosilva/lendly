import type { Metadata } from 'next'
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

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const categories = await fetchCategories()
  const categoryLabel = searchParams.category ? getCategoryLabel(categories, searchParams.category) : undefined
  const subcategoryLabel = searchParams.category
    ? getSubcategoryLabel(categories, searchParams.category, searchParams.subcategory)
    : undefined

  let title = 'Explorar itens — Lendly'
  let description = 'Encontre objetos disponíveis para empréstimo ou aluguel na sua vizinhança no Lendly.'

  if (searchParams.search) {
    title = `Buscar "${searchParams.search}" — Lendly`
    description = `Resultados para "${searchParams.search}" — itens disponíveis pra empréstimo ou aluguel no Lendly.`
  } else if (subcategoryLabel && categoryLabel) {
    title = `${subcategoryLabel} · ${categoryLabel} — Lendly`
    description = `Encontre ${subcategoryLabel.toLowerCase()} (${categoryLabel.toLowerCase()}) disponíveis pra empréstimo ou aluguel na sua vizinhança.`
  } else if (categoryLabel) {
    title = `${categoryLabel} para emprestar ou alugar — Lendly`
    description = `Encontre ${categoryLabel.toLowerCase()} disponíveis pra empréstimo ou aluguel na sua vizinhança.`
  }

  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Lendly', locale: 'pt_BR', type: 'website' },
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
