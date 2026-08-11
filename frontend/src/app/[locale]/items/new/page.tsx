import { getTranslations } from 'next-intl/server'
import ItemForm from '@/components/items/ItemForm'

export default async function NewItemPage() {
  const t = await getTranslations('Items.New')
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>
      <div className="bg-surface rounded-panel border border-border p-8">
        <ItemForm />
      </div>
    </div>
  )
}
