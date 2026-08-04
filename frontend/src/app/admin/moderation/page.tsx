'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldAlert, Package, User as UserIcon, Check, Ban } from 'lucide-react'
import { Report, REPORT_REASON_LABELS } from '@/types'
import { reportsService } from '@/services/reports'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

type Tab = 'pending' | 'resolved'

export default function ModerationPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback(() => {
    if (!user?.is_admin) return
    setLoading(true)
    reportsService.list().then(setReports).finally(() => setLoading(false))
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  const act = async (action: (id: string) => Promise<unknown>, id: string) => {
    setBusy(id)
    try {
      await action(id)
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  const pending = reports.filter((r) => r.status === 'pending')
  const resolved = reports.filter((r) => r.status !== 'pending')
  const visible = tab === 'pending' ? pending : resolved

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moderação</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Denúncias de itens e perfis, pra revisar e agir.
      </p>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0 -mb-px">
          {([
            { id: 'pending' as const, label: 'Pendentes', count: pending.length },
            { id: 'resolved' as const, label: 'Resolvidas', count: resolved.length },
          ]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={tab === 'pending' ? 'Nenhuma denúncia pendente' : 'Nenhuma denúncia resolvida ainda'}
          description={tab === 'pending' ? 'Tudo tranquilo por aqui.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((report) => (
            <div key={report.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  {report.item_id ? <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <UserIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                  {report.item_id ? (
                    <Link href={`/items/${report.item_id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                      {report.item_title}
                    </Link>
                  ) : (
                    <Link href={`/users/${report.reported_user_id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                      {report.reported_user_name}
                    </Link>
                  )}
                </div>
                <Badge variant={report.status === 'pending' ? 'yellow' : report.status === 'actioned' ? 'red' : 'gray'}>
                  {report.status === 'pending' ? 'Pendente' : report.status === 'actioned' ? 'Removido' : 'Dispensada'}
                </Badge>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span className="font-medium">Motivo:</span> {REPORT_REASON_LABELS[report.reason]}
              </p>
              {report.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 mb-2">
                  "{report.description}"
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Denunciado por {report.reporter_name} em {formatDate(report.created_at)}
                {report.reviewed_by_name && report.reviewed_at && (
                  <> · Revisado por {report.reviewed_by_name} em {formatDate(report.reviewed_at)}</>
                )}
              </p>

              {report.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === report.id}
                    onClick={() => act((id) => reportsService.action(id), report.id)}
                  >
                    <Ban className="w-4 h-4" /> Remover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === report.id}
                    onClick={() => act((id) => reportsService.dismiss(id), report.id)}
                  >
                    <Check className="w-4 h-4" /> Dispensar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
