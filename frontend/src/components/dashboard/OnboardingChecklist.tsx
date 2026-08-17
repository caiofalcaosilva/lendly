'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { CircleCheck, Circle, ListChecks, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Tooltip from '@/components/ui/Tooltip'

const DISMISS_KEY = 'onboarding_dismissed'

interface Step {
  key: string
  label: string
  href: string
  done: boolean
}

export default function OnboardingChecklist({
  hasAddress,
  hasItems,
  hasSentRequest,
  hasGroups,
}: {
  hasAddress: boolean
  hasItems: boolean
  hasSentRequest: boolean
  hasGroups: boolean
}) {
  const [dismissed, setDismissed] = useState(true) // starts hidden until localStorage is checked, avoids a flash
  const t = useTranslations('Dashboard.onboarding')

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  const steps: Step[] = [
    { key: 'address', label: t('address'), href: '/profile', done: hasAddress },
    { key: 'item', label: t('item'), href: '/items/new', done: hasItems },
    { key: 'request', label: t('request'), href: '/items', done: hasSentRequest },
    { key: 'group', label: t('group'), href: '/groups', done: hasGroups },
  ]
  const allDone = steps.every((s) => s.done)

  if (dismissed || allDone) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-surface rounded-panel border border-border p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-ink">{t('title')}</h2>
        </div>
        <Tooltip label={t('dismiss')}>
          <button
            onClick={dismiss}
            className="text-ink-subtle hover:text-ink-muted transition-colors"
            aria-label={t('dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-center gap-2.5 text-sm group"
          >
            {step.done ? (
              <CircleCheck className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-ink-subtle flex-shrink-0" />
            )}
            <span className={
              step.done
                ? 'text-ink-subtle line-through'
                : 'text-ink-muted group-hover:text-primary transition-colors'
            }>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
