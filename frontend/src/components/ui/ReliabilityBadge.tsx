import { ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Badge from '@/components/ui/Badge'
import Tooltip from '@/components/ui/Tooltip'

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

  const variant = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <Tooltip label={t('tooltip', { score: Math.round(score), count })}>
      <Badge variant={variant} bordered size={size} icon={<ShieldCheck className={iconSize} />}>
        {Math.round(score)}%
      </Badge>
    </Tooltip>
  )
}
