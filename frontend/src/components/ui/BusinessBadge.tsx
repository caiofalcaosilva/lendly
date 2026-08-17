import { Store } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Badge from '@/components/ui/Badge'
import Tooltip from '@/components/ui/Tooltip'

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

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <Tooltip label={t('tooltip')}>
      <Badge variant="business" bordered size={size} icon={<Store className={iconSize} />}>
        {t('label')}
      </Badge>
    </Tooltip>
  )
}
