'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { ShieldCheck, Check, X as XIcon, Image as ImageIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
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
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<'selfie' | 'document' | null>(null)
  const t = useTranslations('Admin.Verification')

  useEffect(() => {
    let selfieUrl = ''
    let documentUrl = ''
    let cancelled = false
    setError(false)
    Promise.all([
      verificationService.photoUrl(submissionId, 'selfie'),
      verificationService.photoUrl(submissionId, 'document'),
    ])
      .then(([selfie, document]) => {
        if (cancelled) return
        selfieUrl = selfie
        documentUrl = document
        setUrls({ selfie, document })
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
      if (selfieUrl) URL.revokeObjectURL(selfieUrl)
      if (documentUrl) URL.revokeObjectURL(documentUrl)
    }
  }, [submissionId])

  useEffect(() => {
    if (!expanded) return
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  if (error) {
    return <p className="text-sm text-danger py-2">{t('photoLoadError')}</p>
  }

  if (!urls) return <div className="flex justify-center py-6"><Spinner className="w-5 h-5 text-primary" /></div>

  return (
    <>
      <div className="flex gap-3">
        <button type="button" onClick={() => setExpanded('selfie')} className="cursor-zoom-in">
          {/* eslint-disable-next-line @next/next/no-img-element -- protected blob: preview, next/image can't fetch it */}
          <img src={urls.selfie} alt={t('selfie')} className="w-28 h-28 object-cover rounded-control border border-border hover:opacity-90 transition-opacity" />
        </button>
        <button type="button" onClick={() => setExpanded('document')} className="cursor-zoom-in">
          {/* eslint-disable-next-line @next/next/no-img-element -- protected blob: preview, next/image can't fetch it */}
          <img src={urls.document} alt={t('document')} className="w-28 h-28 object-cover rounded-control border border-border hover:opacity-90 transition-opacity" />
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          <div className="absolute inset-0 bg-black/80" />
          <button
            type="button"
            onClick={() => setExpanded(null)}
            aria-label={t('close')}
            className="absolute top-4 right-4 p-2 rounded-control text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <XIcon className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- protected blob: preview, next/image can't fetch it */}
          <img
            src={urls[expanded]}
            alt={t(expanded)}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-[90vh] object-contain rounded-control"
          />
        </div>
      )}
    </>
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
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Verification')

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
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  const pending = submissions.filter((s) => s.status === 'pending')
  const resolved = submissions.filter((s) => s.status !== 'pending')
  const visible = tab === 'pending' ? pending : resolved

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-8">
        {t('subtitle')}
      </p>

      <div className="border-b border-border mb-6">
        <div className="flex gap-0 -mb-px">
          {([
            { id: 'pending' as const, label: t('pending'), count: pending.length },
            { id: 'resolved' as const, label: t('resolved'), count: resolved.length },
          ]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted hover:text-ink-muted'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="bg-surface-2 text-ink-muted text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={tab === 'pending' ? t('emptyPending') : t('emptyResolved')}
          description={tab === 'pending' ? t('emptyPendingDescription') : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((sub) => (
            <div key={sub.id} className="bg-surface rounded-panel border border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{sub.user_name}</p>
                  <p className="text-sm text-ink-muted">{t('cpf')}: {sub.cpf}</p>
                </div>
                <Badge variant={sub.status === 'pending' ? 'yellow' : sub.status === 'approved' ? 'green' : 'red'}>
                  {sub.status === 'pending' ? t('statusPending') : sub.status === 'approved' ? t('statusApproved') : t('statusRejected')}
                </Badge>
              </div>

              {sub.rejection_reason && (
                <p className="text-sm text-danger bg-danger-subtle rounded-control p-2 mb-2">
                  {t('reason', { reason: sub.rejection_reason })}
                </p>
              )}

              <p className="text-xs text-ink-subtle mb-2">
                {t('submittedOn', { date: formatDate(sub.created_at, locale) })}
                {sub.reviewed_by_name && sub.reviewed_at && (
                  <> · {t('reviewedBy', { name: sub.reviewed_by_name, date: formatDate(sub.reviewed_at, locale) })}</>
                )}
              </p>

              {showPhotos === sub.id ? (
                <PhotoPreview submissionId={sub.id} />
              ) : (
                <button
                  onClick={() => setShowPhotos(sub.id)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ImageIcon className="w-4 h-4" /> {t('viewPhotos')}
                </button>
              )}

              {(sub.status === 'pending' || sub.status === 'approved') && (
                <div className="mt-4">
                  {rejecting === sub.id ? (
                    <div className="flex flex-col gap-2">
                      {sub.status === 'approved' && (
                        <p className="text-xs text-danger">{t('revokeWarning')}</p>
                      )}
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('rejectionReasonPlaceholder')}
                        className="w-full border border-border bg-surface text-ink rounded-control px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" loading={busy === sub.id} onClick={() => confirmReject(sub.id)}>
                          {sub.status === 'approved' ? t('confirmRevocation') : t('confirmRejection')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejecting(null); setReason('') }}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : sub.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button size="sm" loading={busy === sub.id} onClick={() => approve(sub.id)}>
                        <Check className="w-4 h-4" /> {t('approve')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejecting(sub.id)}>
                        <XIcon className="w-4 h-4" /> {t('reject')}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setRejecting(sub.id)}>
                      <XIcon className="w-4 h-4" /> {t('revokeApproval')}
                    </Button>
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
