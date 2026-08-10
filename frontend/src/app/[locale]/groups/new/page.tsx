'use client'
import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { groupsService } from '@/services/groups'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Groups.New')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const group = await groupsService.create({ name, description: description || undefined })
      router.push(`/groups/${group.id}`)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorCreating'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

        <Input
          label={t('groupName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t('optional')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading} disabled={!name.trim()} className="flex-1">
            {t('title')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
