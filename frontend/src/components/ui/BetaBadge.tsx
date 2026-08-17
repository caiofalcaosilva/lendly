import { useTranslations } from 'next-intl'
import Tooltip from '@/components/ui/Tooltip'

/// Temporary lifecycle notice, not a product-state badge — see
/// design_system.md for why it's magenta (deliberately outside the
/// semantic token system) and the criteria for when to remove it.
export default function BetaBadge() {
  const t = useTranslations('Common.BetaBadge')

  return (
    <Tooltip label={t('tooltip')}>
      <span className="beta-badge inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white -rotate-2">
        {t('label')}
      </span>
    </Tooltip>
  )
}
