'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

const FAQ_KEYS = ['howItWorks', 'safety', 'payment', 'damage', 'cost'] as const

export default function FaqClient() {
  const t = useTranslations('Faq')
  const [openKey, setOpenKey] = useState<(typeof FAQ_KEYS)[number] | null>(FAQ_KEYS[0])

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        {FAQ_KEYS.map((key) => {
          const isOpen = openKey === key
          return (
            <div key={key} className="bg-surface rounded-panel border border-border shadow-subtle overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-medium text-ink">{t(`items.${key}.question`)}</span>
                <ChevronDown
                  className={`w-5 h-5 text-ink-subtle flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 text-sm text-ink-muted leading-relaxed">
                  {t(`items.${key}.answer`)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
