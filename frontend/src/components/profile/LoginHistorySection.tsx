'use client'
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { usersService } from '@/services/users'
import { LoginHistoryEntry } from '@/types'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

// Good-enough device summary from the User-Agent string — not meant to be
// exhaustive, just enough for a user to recognize "that's my phone."
function summarizeDevice(userAgent?: string | null): string {
  if (!userAgent) return 'Dispositivo desconhecido'
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
  return [browser, os].filter(Boolean).join(' · ') || 'Dispositivo desconhecido'
}

export default function LoginHistorySection() {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersService.getLoginHistory().then(setHistory).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 mb-1">
        <History className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Histórico de login</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Últimos acessos à sua conta — se algo aqui não for você, troque sua senha.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-green-600" /></div>
      ) : history.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Nenhum login registrado ainda.</p>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 max-h-64 overflow-y-auto">
          {history.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-600 dark:text-gray-300">
                {summarizeDevice(entry.user_agent)}
                {entry.ip_address ? ` · ${entry.ip_address}` : ''} · {formatDate(entry.created_at)}
              </span>
              {entry.revoked && (
                <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">Encerrada</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
