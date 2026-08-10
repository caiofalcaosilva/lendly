import { ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

/// Behavioral reliability score (0-100), distinct from the 1-5 star
/// average_rating — based on on-time returns / late returns / refusals /
/// cancellations. Renders nothing until the user has at least one
/// qualifying loan-request event, so new users aren't shown a discouraging
/// "0%" badge.
export default function ReliabilityBadge({
  score,
  count,
  size = 'sm',
}: {
  score?: number | null
  count: number
  size?: 'sm' | 'md'
}) {
  const t = useTranslations('Common.ReliabilityBadge')

  if (!count || score == null) return null

  const tone =
    score >= 80
      ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
      : score >= 50
        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
        : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium flex-shrink-0 ${tone} ${sizeClasses}`}
      title={t('tooltip', { score: Math.round(score), count })}
    >
      <ShieldCheck className={iconSize} />
      {Math.round(score)}%
    </span>
  )
}
