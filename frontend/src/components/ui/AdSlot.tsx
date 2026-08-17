import { Megaphone } from 'lucide-react'
import { useTranslations } from 'next-intl'

/// Visual placeholder for a future paid-ad slot — not wired to any ad
/// network yet, just reserves and labels the space. Distinct from
/// PlatformSettings.items_banner_* (the admin-configurable info banner),
/// which is real content the platform itself controls.
export default function AdSlot() {
  const t = useTranslations('Common.AdSlot')

  return (
    <div className="flex items-center justify-center gap-2 py-6 mb-6 rounded-panel border-2 border-dashed border-border text-ink-subtle text-sm">
      <Megaphone className="w-4 h-4" />
      {t('placeholder')}
    </div>
  )
}
