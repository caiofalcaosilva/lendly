'use client'
import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Settings as SettingsIcon, CheckCircle2, Megaphone, PanelTop } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { PlatformSettings } from '@/types'
import { platformSettingsService } from '@/services/platformSettings'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Checkbox from '@/components/ui/Checkbox'
import ItemsBannerSlidesManager from '@/components/admin/ItemsBannerSlidesManager'

const FIELD_KEYS: (keyof PlatformSettings)[] = [
  'access_token_expire_minutes', 'refresh_token_expire_days', 'email_verification_expire_hours',
  'login_rate_limit_per_minute', 'login_max_attempts', 'login_lockout_minutes',
  'register_rate_limit_per_minute', 'complete_2fa_rate_limit_per_minute',
  'refresh_rate_limit_per_minute', 'resend_verification_rate_limit_per_minute',
  'phone_verification_expire_minutes', 'phone_verification_rate_limit_per_minute',
  'chat_message_rate_limit_per_minute', 'password_reset_rate_limit_per_minute',
  'group_create_rate_limit_per_minute', 'group_post_rate_limit_per_minute',
  'handoff_confirmation_grace_hours', 'claim_filing_window_hours',
  'claim_payment_deadline_days',
]

export default function AdminSettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Settings')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (!user?.is_admin) return
    platformSettingsService.get().then(setSettings).finally(() => setLoading(false))
  }, [user?.is_admin])

  const setField = (key: keyof PlatformSettings, value: number) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const onSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await platformSettingsService.update({
        access_token_expire_minutes: settings.access_token_expire_minutes,
        refresh_token_expire_days: settings.refresh_token_expire_days,
        email_verification_expire_hours: settings.email_verification_expire_hours,
        login_rate_limit_per_minute: settings.login_rate_limit_per_minute,
        login_max_attempts: settings.login_max_attempts,
        login_lockout_minutes: settings.login_lockout_minutes,
        register_rate_limit_per_minute: settings.register_rate_limit_per_minute,
        complete_2fa_rate_limit_per_minute: settings.complete_2fa_rate_limit_per_minute,
        refresh_rate_limit_per_minute: settings.refresh_rate_limit_per_minute,
        resend_verification_rate_limit_per_minute:
          settings.resend_verification_rate_limit_per_minute,
        phone_verification_expire_minutes: settings.phone_verification_expire_minutes,
        phone_verification_rate_limit_per_minute:
          settings.phone_verification_rate_limit_per_minute,
        chat_message_rate_limit_per_minute: settings.chat_message_rate_limit_per_minute,
        password_reset_rate_limit_per_minute: settings.password_reset_rate_limit_per_minute,
        group_create_rate_limit_per_minute: settings.group_create_rate_limit_per_minute,
        group_post_rate_limit_per_minute: settings.group_post_rate_limit_per_minute,
        handoff_confirmation_grace_hours: settings.handoff_confirmation_grace_hours,
        claim_filing_window_hours: settings.claim_filing_window_hours,
        claim_payment_deadline_days: settings.claim_payment_deadline_days,
        claim_late_fee_percent: settings.claim_late_fee_percent,
        announcement_message: settings.announcement_message ?? '',
        announcement_active: settings.announcement_active,
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorSaving'))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <SettingsIcon className="w-6 h-6 text-info" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-8">
        {t('subtitle')}
      </p>

      {loading || !settings ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : (
        <div className="bg-surface rounded-panel border border-border p-6 space-y-5">
          {error && (
            <div className="p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
              {error}
            </div>
          )}

          {FIELD_KEYS.map((key) => (
            <Input
              key={key}
              label={t(`fields.${key}.label`)}
              helper={t(`fields.${key}.helper`)}
              type="number"
              min={1}
              value={settings[key] as number}
              onChange={(e) => setField(key, Number(e.target.value))}
            />
          ))}

          <Input
            label={t('fields.claim_late_fee_percent.label')}
            helper={t('fields.claim_late_fee_percent.helper')}
            type="number"
            step="0.01"
            min={0}
            value={settings.claim_late_fee_percent}
            onChange={(e) => setField('claim_late_fee_percent', Number(e.target.value))}
          />

          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-info" />
              <span className="text-sm font-medium text-ink-muted">{t('announcement')}</span>
            </div>
            <p className="text-xs text-ink-muted -mt-2">
              {t('announcementHint')}
            </p>
            <Textarea
              value={settings.announcement_message ?? ''}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, announcement_message: e.target.value.slice(0, 280) } : prev))}
              rows={2}
              maxLength={280}
              placeholder={t('announcementPlaceholder')}
              className="resize-none"
            />
            <Checkbox
              checked={settings.announcement_active}
              onChange={(checked) => setSettings((prev) => (prev ? { ...prev, announcement_active: checked } : prev))}
              label={t('announcementActive')}
            />
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <PanelTop className="w-4 h-4 text-info" />
              <span className="text-sm font-medium text-ink-muted">{t('itemsBanner')}</span>
            </div>
            <p className="text-xs text-ink-muted -mt-2">
              {t('itemsBannerHint')}
            </p>
            <ItemsBannerSlidesManager />
          </div>

          {settings.updated_by_name && settings.updated_at && (
            <p className="text-xs text-ink-subtle">
              {t('lastUpdated', { name: settings.updated_by_name, date: formatDate(settings.updated_at, locale) })}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onSave} loading={saving}>
              {t('saveChanges')}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" /> {t('saved')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
