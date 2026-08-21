import { SearchX } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Button from '@/components/ui/Button'

export default async function NotFound() {
  const t = await getTranslations('NotFound')

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
        <SearchX className="w-8 h-8 text-ink-subtle" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">{t('title')}</h1>
      <p className="text-ink-muted text-sm mb-6 max-w-xs">{t('description')}</p>
      <Link href="/">
        <Button>{t('backHome')}</Button>
      </Link>
    </div>
  )
}
