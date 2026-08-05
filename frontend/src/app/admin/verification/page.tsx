'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Check, X as XIcon, Image as ImageIcon } from 'lucide-react'
import { VerificationSubmission } from '@/types'
import { verificationService } from '@/services/verification'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

type Tab = 'pending' | 'resolved'

function PhotoPreview({ submissionId }: { submissionId: string }) {
  const [urls, setUrls] = useState<{ selfie: string; document: string } | null>(null)

  useEffect(() => {
    let selfieUrl = ''
    let documentUrl = ''
    Promise.all([
      verificationService.photoUrl(submissionId, 'selfie'),
      verificationService.photoUrl(submissionId, 'document'),
    ]).then(([selfie, document]) => {
      selfieUrl = selfie
      documentUrl = document
      setUrls({ selfie, document })
    })
    return () => {
      if (selfieUrl) URL.revokeObjectURL(selfieUrl)
      if (documentUrl) URL.revokeObjectURL(documentUrl)
    }
  }, [submissionId])

  if (!urls) return <div className="flex justify-center py-6"><Spinner className="w-5 h-5 text-green-600" /></div>

  return (
    <div className="flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- protected blob: preview, next/image can't fetch it */}
      <img src={urls.selfie} alt="Selfie" className="w-28 h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
      {/* eslint-disable-next-line @next/next/no-img-element -- protected blob: preview, next/image can't fetch it */}
      <img src={urls.document} alt="Documento" className="w-28 h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
    </div>
  )
}

export default function AdminVerificationPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showPhotos, setShowPhotos] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback(() => {
    if (!user?.is_admin) return
    setLoading(true)
    verificationService.list().then(setSubmissions).finally(() => setLoading(false))
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    setBusy(id)
    try {
      await verificationService.approve(id)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const confirmReject = async (id: string) => {
    setBusy(id)
    try {
      await verificationService.reject(id, reason || undefined)
      setRejecting(null)
      setReason('')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  const pending = submissions.filter((s) => s.status === 'pending')
  const resolved = submissions.filter((s) => s.status !== 'pending')
  const visible = tab === 'pending' ? pending : resolved

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verificação de identidade</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Fila de submissões de CPF + fotos, pra revisar e aprovar ou rejeitar.
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
          icon={ShieldCheck}
          title={tab === 'pending' ? 'Nenhuma verificação pendente' : 'Nenhuma verificação resolvida ainda'}
          description={tab === 'pending' ? 'Tudo tranquilo por aqui.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((sub) => (
            <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{sub.user_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">CPF: {sub.cpf}</p>
                </div>
                <Badge variant={sub.status === 'pending' ? 'yellow' : sub.status === 'approved' ? 'green' : 'red'}>
                  {sub.status === 'pending' ? 'Pendente' : sub.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                </Badge>
              </div>

              {sub.rejection_reason && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2 mb-2">
                  Motivo: {sub.rejection_reason}
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Enviado em {formatDate(sub.created_at)}
                {sub.reviewed_by_name && sub.reviewed_at && (
                  <> · Revisado por {sub.reviewed_by_name} em {formatDate(sub.reviewed_at)}</>
                )}
              </p>

              {showPhotos === sub.id ? (
                <PhotoPreview submissionId={sub.id} />
              ) : (
                <button
                  onClick={() => setShowPhotos(sub.id)}
                  className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:underline"
                >
                  <ImageIcon className="w-4 h-4" /> Ver fotos
                </button>
              )}

              {sub.status === 'pending' && (
                <div className="mt-4">
                  {rejecting === sub.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Motivo da rejeição (opcional)"
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" loading={busy === sub.id} onClick={() => confirmReject(sub.id)}>
                          Confirmar rejeição
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejecting(null); setReason('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" loading={busy === sub.id} onClick={() => approve(sub.id)}>
                        <Check className="w-4 h-4" /> Aprovar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejecting(sub.id)}>
                        <XIcon className="w-4 h-4" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
