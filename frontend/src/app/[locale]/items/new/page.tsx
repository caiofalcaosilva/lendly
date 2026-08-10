import { getTranslations } from 'next-intl/server'
import ItemForm from '@/components/items/ItemForm'

export default async function NewItemPage() {
  const t = await getTranslations('Items.New')
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <ItemForm />
      </div>
    </div>
  )
}
