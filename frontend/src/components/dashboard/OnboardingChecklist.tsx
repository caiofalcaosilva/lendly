'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Circle, ListChecks, X } from 'lucide-react'

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
}: {
  hasAddress: boolean
  hasItems: boolean
  hasSentRequest: boolean
}) {
  const [dismissed, setDismissed] = useState(true) // starts hidden until localStorage is checked, avoids a flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  const steps: Step[] = [
    { key: 'address', label: 'Complete seu endereço', href: '/profile', done: hasAddress },
    { key: 'item', label: 'Anuncie seu primeiro item', href: '/items/new', done: hasItems },
    { key: 'request', label: 'Faça sua primeira solicitação', href: '/items', done: hasSentRequest },
  ]
  const allDone = steps.every((s) => s.done)

  if (dismissed || allDone) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-green-600 dark:text-green-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Primeiros passos</h2>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-center gap-2.5 text-sm group"
          >
            {step.done ? (
              <CircleCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <span className={
              step.done
                ? 'text-gray-400 dark:text-gray-500 line-through'
                : 'text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors'
            }>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
