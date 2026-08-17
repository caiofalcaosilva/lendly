'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import { NotificationPreferences, User } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import Switch from '@/components/ui/Switch'

const OPTION_KEYS: (keyof NotificationPreferences)[] = [
  'request_status', 'new_message', 'verification_result', 'item_available', 'review_reminder',
]

export default function NotificationPreferencesSection({
  user,
  updateUser,
}: {
  user: User
  updateUser: (user: User) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const t = useTranslations('Common.NotificationPreferencesSection')
  const toast = useToast()

  const toggle = async (key: keyof NotificationPreferences) => {
    setSaving(key)
    try {
      const updated = await usersService.updateNotificationPreferences({
        [key]: !user.notification_prefs[key],
      })
      updateUser(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-4 rounded-panel border border-border bg-surface-2">
      <div className="flex items-start gap-3 mb-1">
        <Bell className="w-5 h-5 text-ink-subtle mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{t('title')}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {t('securityNotice')}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border space-y-2.5">
        {OPTION_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 text-xs text-ink-muted">
            {t(`options.${key}`)}
            <Switch
              checked={user.notification_prefs[key]}
              onChange={() => toggle(key)}
              disabled={saving === key}
              label={t(`options.${key}`)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
