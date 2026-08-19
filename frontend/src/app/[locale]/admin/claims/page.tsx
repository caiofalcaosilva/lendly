'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { HandCoins, Package, Check, X as XIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Claim, ClaimStatus, FundSummary } from '@/types'
import { claimsService } from '@/services/claims'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/contexts/ToastContext'

const STATUS_COLORS: Record<ClaimStatus, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  pending: 'yellow',
  approved: 'blue',
  rejected: 'red',
  paid: 'green',
}

const TABS: ClaimStatus[] = ['pending', 'approved', 'rejected', 'paid']

export default function AdminClaimsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<ClaimStatus>('pending')
  const [claims, setClaims] = useState<Claim[]>([])
  const [summary, setSummary] = useState<FundSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [approveAmount, setApproveAmount] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Claims')
  const toast = useToast()

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback(() => {
    if (!user?.is_admin) return
    setLoading(true)
    Promise.all([claimsService.list(), claimsService.fundSummary()])
      .then(([claimsList, fundSummary]) => {
        setClaims(claimsList)
        setSummary(fundSummary)
      })
      .finally(() => setLoading(false))
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    const amount = Number(approveAmount)
    if (!approveAmount || Number.isNaN(amount) || amount <= 0) return
    setBusy(id)
    try {
      await claimsService.approve(id, amount)
      setApproveTarget(null)
      setApproveAmount('')
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(null)
    }
  }

  const reject = async (id: string) => {
    if (rejectReason.trim().length < 3) return
    setBusy(id)
    try {
      await claimsService.reject(id, rejectReason.trim())
      setRejectTarget(null)
      setRejectReason('')
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(null)
    }
  }

  const markPaid = async (id: string) => {
    setBusy(id)
    try {
      await claimsService.markPaid(id)
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(null)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  const visible = claims.filter((c) => c.status === tab)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <HandCoins className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-6">{t('subtitle')}</p>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-surface rounded-panel border border-border p-4">
            <p className="text-xs text-ink-subtle mb-1">{t('collected')}</p>
            <p className="text-lg font-bold font-mono tabular-nums text-ink">{formatCurrency(summary.collected, locale)}</p>
          </div>
          <div className="bg-surface rounded-panel border border-border p-4">
            <p className="text-xs text-ink-subtle mb-1">{t('paidOut')}</p>
            <p className="text-lg font-bold font-mono tabular-nums text-ink">{formatCurrency(summary.paid_out, locale)}</p>
          </div>
          <div className="bg-surface rounded-panel border border-border p-4">
            <p className="text-xs text-ink-subtle mb-1">{t('balance')}</p>
            <p className={`text-lg font-bold font-mono tabular-nums ${summary.balance < 0 ? 'text-danger' : 'text-primary'}`}>
              {formatCurrency(summary.balance, locale)}
            </p>
          </div>
        </div>
      )}

      <div className="border-b border-border mb-6 overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 -mb-px w-max">
          {TABS.map((status) => {
            const count = claims.filter((c) => c.status === status).length
            return (
              <button
                key={status}
                onClick={() => setTab(status)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === status
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {t(`status.${status}`)}
                {count > 0 && (
                  <span className="bg-surface-2 text-ink-muted text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={HandCoins} title={t('empty')} />
      ) : (
        <div className="space-y-3">
          {visible.map((claim) => (
            <div key={claim.id} className="bg-surface rounded-panel border border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-ink-subtle flex-shrink-0" />
                  <Link href={`/items/${claim.item_id}`} className="font-medium text-ink hover:text-primary transition-colors truncate">
                    {claim.item_title}
                  </Link>
                </div>
                <Badge variant={STATUS_COLORS[claim.status]}>{t(`statusBadge.${claim.status}`)}</Badge>
              </div>

              <p className="text-xs text-ink-subtle mb-2">
                {t.rich('filedBy', { name: claim.owner_name, date: formatDate(claim.created_at, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })}
              </p>

              <p className="text-sm text-ink-muted bg-surface-2 rounded-control p-3 mb-3">&ldquo;{claim.description}&rdquo;</p>

              {claim.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {claim.photos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element -- evidence photos from R2/disk storage, not next/image-optimized
                    <img key={url} src={url} alt="" className="w-20 h-20 rounded-control object-cover border border-border" />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm mb-3">
                <span className="text-ink-muted">
                  {t('requestedAmount')} <strong className="text-ink font-mono tabular-nums">{formatCurrency(claim.requested_amount, locale)}</strong>
                </span>
                <span className="text-ink-subtle">
                  {t('ceiling')} <span className="font-mono tabular-nums">{formatCurrency(claim.declared_value, locale)}</span>
                </span>
              </div>

              {claim.approved_amount != null && (
                <p className="text-sm text-primary mb-2">
                  {t('approvedAmount')} <strong className="font-mono tabular-nums">{formatCurrency(claim.approved_amount, locale)}</strong>
                </p>
              )}
              {claim.rejection_reason && (
                <p className="text-sm text-danger mb-2">{t('rejectionReason')} {claim.rejection_reason}</p>
              )}
              {claim.reviewed_by_name && claim.reviewed_at && (
                <p className="text-xs text-ink-subtle mb-2">
                  {t.rich('reviewedBy', { name: claim.reviewed_by_name, date: formatDate(claim.reviewed_at, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })}
                </p>
              )}

              {claim.status === 'pending' && (
                <div className="mt-3">
                  {approveTarget === claim.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        label={t('approvedAmountLabel')}
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={claim.declared_value}
                        value={approveAmount}
                        onChange={(e) => setApproveAmount(e.target.value)}
                        className="max-w-[160px]"
                      />
                      <Button size="sm" loading={busy === claim.id} onClick={() => approve(claim.id)}>
                        <Check className="w-4 h-4" /> {t('confirm')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setApproveTarget(null)}>{t('cancel')}</Button>
                    </div>
                  ) : rejectTarget === claim.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Textarea
                        label={t('rejectReasonLabel')}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        className="flex-1"
                      />
                      <Button size="sm" variant="danger" loading={busy === claim.id} onClick={() => reject(claim.id)}>
                        <XIcon className="w-4 h-4" /> {t('confirm')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectTarget(null)}>{t('cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setApproveTarget(claim.id); setApproveAmount(String(claim.requested_amount)) }}>
                        <Check className="w-4 h-4" /> {t('approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectTarget(claim.id)}>
                        <XIcon className="w-4 h-4" /> {t('reject')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {claim.status === 'approved' && (
                <Button size="sm" loading={busy === claim.id} onClick={() => markPaid(claim.id)}>
                  {t('markPaid')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
