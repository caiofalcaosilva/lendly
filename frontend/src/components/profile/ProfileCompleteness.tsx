'use client'
import { CheckCircle2, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { User } from '@/types'

function buildChecks(user: User, t: ReturnType<typeof useTranslations>) {
  const checks = [
    { key: 'avatar', label: t('avatar'), done: !!user.avatar_url },
    { key: 'bio', label: user.account_type === 'business' ? t('aboutBusiness') : t('bio'), done: !!user.bio },
    { key: 'phone', label: t('phone'), done: !!user.phone },
    { key: 'address', label: t('address'), done: !!user.zip_code },
    { key: 'verified', label: t('emailVerified'), done: user.is_verified },
    { key: '2fa', label: t('twoFactor'), done: user.totp_enabled },
  ]
  // Only counted once a phone exists at all — otherwise "no phone" would
  // count as two separate incomplete items (phone + phoneVerified) for
  // what's really one gap. Email has no equivalent case since it's
  // always present (required at signup).
  if (user.phone) {
    checks.push({ key: 'phoneVerified', label: t('phoneVerified'), done: !!user.phone_verified })
  }
  if (user.account_type === 'business') {
    checks.push({
      key: 'contact',
      label: t('contact'),
      done: !!(user.website || user.instagram || user.whatsapp),
    })
  }
  return checks
}

// Hides itself once complete — a permanent 100% badge would be a
// participation trophy, not a signal worth showing.
export default function ProfileCompleteness({ user }: { user: User }) {
  const t = useTranslations('Common.ProfileCompleteness')
  const checks = buildChecks(user, t)
  const doneCount = checks.filter((c) => c.done).length
  const percent = Math.round((doneCount / checks.length) * 100)

  if (percent >= 100) return null

  return (
    <div className="bg-surface rounded-panel border border-border p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ink-muted">{t('percentComplete', { percent })}</p>
        <span className="text-xs text-ink-subtle">{doneCount}/{checks.length}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {checks.map((c) => (
          <span
            key={c.key}
            className={`flex items-center gap-1 text-xs ${
              c.done ? 'text-ink-subtle line-through' : 'text-ink-muted'
            }`}
          >
            {c.done ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Circle className="w-3 h-3" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}
