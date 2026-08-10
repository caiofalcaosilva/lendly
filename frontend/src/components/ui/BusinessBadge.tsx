import { Store } from 'lucide-react'
import { useTranslations } from 'next-intl'

/// Marks an account as a business (vs. an individual neighbor) — see
/// roadmap "Contas de empresas". Renders nothing for individual accounts.
export default function BusinessBadge({
  accountType,
  size = 'sm',
}: {
  accountType?: 'individual' | 'business'
  size?: 'sm' | 'md'
}) {
  const t = useTranslations('Common.BusinessBadge')

  if (accountType !== 'business') return null

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium flex-shrink-0 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 ${sizeClasses}`}
      title={t('tooltip')}
    >
      <Store className={iconSize} />
      {t('label')}
    </span>
  )
}
