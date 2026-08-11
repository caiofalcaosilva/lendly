'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Item } from '@/types'
import { itemsService } from '@/services/items'
import ItemForm from '@/components/items/ItemForm'
import Spinner from '@/components/ui/Spinner'

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Items.Id.Edit')

  useEffect(() => {
    itemsService.get(id).then(setItem).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner className="w-8 h-8 text-primary" />
    </div>
  )

  if (!item) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-ink-muted">
      {t('notFound')}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted text-sm mt-1">{item.title}</p>
      </div>
      <div className="bg-surface rounded-panel border border-border p-8">
        <ItemForm item={item} />
      </div>
    </div>
  )
}
