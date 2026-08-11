'use client'
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import { LoginHistoryEntry } from '@/types'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

// Good-enough device summary from the User-Agent string — not meant to be
// exhaustive, just enough for a user to recognize "that's my phone."
function summarizeDevice(userAgent: string | null | undefined, unknownLabel: string): string {
  if (!userAgent) return unknownLabel
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'Mac'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null
  return [browser, os].filter(Boolean).join(' · ') || unknownLabel
}

export default function LoginHistorySection() {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.LoginHistorySection')

  useEffect(() => {
    usersService.getLoginHistory().then(setHistory).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 rounded-panel border border-border bg-surface-2">
      <div className="flex items-start gap-3 mb-1">
        <History className="w-5 h-5 text-ink-subtle mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{t('title')}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {t('description')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
      ) : history.length === 0 ? (
        <p className="text-xs text-ink-subtle mt-3">{t('noHistory')}</p>
      ) : (
        <div className="mt-3 pt-3 border-t border-border space-y-2 max-h-64 overflow-y-auto">
          {history.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-muted">
                {summarizeDevice(entry.user_agent, t('unknownDevice'))}
                {entry.ip_address ? ` · ${entry.ip_address}` : ''} · {formatDate(entry.created_at, locale)}
              </span>
              {entry.revoked && (
                <span className="flex-shrink-0 text-ink-subtle">{t('ended')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
