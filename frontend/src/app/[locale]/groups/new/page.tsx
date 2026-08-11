'use client'
import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { groupsService } from '@/services/groups'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
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
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-panel border border-border p-6 space-y-5">
        {error && <div className="p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">{error}</div>}

        <Input
          label={t('groupName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          required
        />

        <Textarea
          label={t('description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t('optional')}
        />

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
