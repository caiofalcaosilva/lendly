'use client'
import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Button from '@/components/ui/Button'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('ErrorPage')

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 bg-danger-subtle rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-danger" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">{t('title')}</h1>
      <p className="text-ink-muted text-sm mb-6 max-w-xs">{t('description')}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t('retry')}</Button>
        <Link href="/">
          <Button variant="outline">{t('backHome')}</Button>
        </Link>
      </div>
    </div>
  )
}
