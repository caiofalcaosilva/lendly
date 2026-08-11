'use client'
import { Suspense } from 'react'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/navigation'

function LanguageSwitcherButton({ compact }: { compact?: boolean }) {
  const locale = useLocale() as 'pt' | 'en'
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const nextLocale = locale === 'pt' ? 'en' : 'pt'

  const switchLocale = () => {
    router.replace({ pathname, query: Object.fromEntries(searchParams) }, { locale: nextLocale })
  }

  return (
    <button
      onClick={switchLocale}
      className={`font-semibold text-ink-muted hover:text-ink transition-colors ${compact ? 'p-2 text-sm' : 'text-xs w-7 text-center'}`}
      title={nextLocale === 'en' ? 'Switch to English' : 'Mudar para português'}
    >
      {nextLocale.toUpperCase()}
    </button>
  )
}

export default function LanguageSwitcher(props: { compact?: boolean }) {
  return (
    <Suspense fallback={<span className={props.compact ? 'p-2 text-sm inline-block w-8' : 'text-xs w-7 inline-block'} />}>
      <LanguageSwitcherButton {...props} />
    </Suspense>
  )
}
