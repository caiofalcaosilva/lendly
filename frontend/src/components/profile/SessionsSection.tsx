'use client'
import { useEffect, useState } from 'react'
import { Laptop, X } from 'lucide-react'
import { usersService } from '@/services/users'
import { SessionSummary } from '@/types'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

export default function SessionsSection() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    usersService.getSessions().then(setSessions).finally(() => setLoading(false))
  }, [])

  const revoke = async (id: string) => {
    setRevoking(id)
    try {
      await usersService.revokeSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 mb-1">
        <Laptop className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dispositivos conectados</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Sessões que continuam renovando seu login automaticamente. Revogue as que você não reconhece.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-green-600" /></div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Nenhuma sessão ativa além desta.</p>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-600 dark:text-gray-300">
                Conectado em {formatDate(s.created_at)} · expira em {formatDate(s.expires_at)}
              </span>
              <button
                onClick={() => revoke(s.id)}
                disabled={revoking === s.id}
                title="Revogar sessão"
                className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
