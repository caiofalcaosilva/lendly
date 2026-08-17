'use client'
import { useEffect, useState } from 'react'
import { Laptop, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import { SessionSummary } from '@/types'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/contexts/ToastContext'

export default function SessionsSection() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.SessionsSection')
  const toast = useToast()

  useEffect(() => {
    usersService.getSessions().then(setSessions).finally(() => setLoading(false))
  }, [])

  const revoke = async (id: string) => {
    setRevoking(id)
    try {
      await usersService.revokeSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch {
      toast.error(t('error'))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="p-4 rounded-panel border border-border bg-surface-2">
      <div className="flex items-start gap-3 mb-1">
        <Laptop className="w-5 h-5 text-ink-subtle mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{t('title')}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {t('description')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-ink-subtle mt-3">{t('noOtherSessions')}</p>
      ) : (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-muted break-words min-w-0">
                {s.ip_address ? `${s.ip_address} · ` : ''}
                {t('sessionInfo', { created: formatDate(s.created_at, locale), expires: formatDate(s.expires_at, locale) })}
              </span>
              <Tooltip label={t('revoke')}>
                <button
                  onClick={() => revoke(s.id)}
                  disabled={revoking === s.id}
                  aria-label={t('revoke')}
                  className="flex-shrink-0 text-ink-subtle hover:text-danger transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
