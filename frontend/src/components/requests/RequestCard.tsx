'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Calendar, MessageCircle, Package, CalendarClock, Check, X as XIcon, Phone } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { LoanRequest, PaymentStatus } from '@/types'
import { requestsService } from '@/services/requests'
import { formatDate } from '@/lib/utils'
import Badge, { CLAIM_STATUS_COLORS, STATUS_COLORS } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ReviewModal from '@/components/reviews/ReviewModal'
import ExtensionModal from '@/components/requests/ExtensionModal'
import ClaimModal from '@/components/requests/ClaimModal'
import PixCheckout from '@/components/requests/PixCheckout'
import ExtensionPixCheckout from '@/components/requests/ExtensionPixCheckout'
import ClaimPixCheckout from '@/components/requests/ClaimPixCheckout'
import DeliveryCodeConfirm from '@/components/requests/DeliveryCodeConfirm'

// Claim statuses where the requester still has an active Pix charge to
// pay off — either the original owner-bound one or, once the platform
// has advanced an overdue paid-item claim's owner, the debt-to-platform one.
const CLAIM_STATUSES_WITH_PENDING_CHARGE = ['approved', 'overdue', 'advanced_by_lendly']

const PAYMENT_STATUS_KEYS: Partial<Record<PaymentStatus, string>> = {
  processing: 'processing',
  held: 'held',
  released: 'released',
  refunded: 'refunded',
  failed: 'failed',
}

const PAYMENT_STATUS_COLORS: Partial<Record<PaymentStatus, 'green' | 'blue' | 'yellow' | 'red' | 'gray'>> = {
  processing: 'yellow',
  held: 'blue',
  released: 'green',
  refunded: 'gray',
  failed: 'red',
}

interface Props {
  request: LoanRequest
  role: 'requester' | 'owner'
  onUpdate: () => void
}

export default function RequestCard({ request: req, role, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [showExtension, setShowExtension] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [showReturnPrompt, setShowReturnPrompt] = useState(false)
  const [actionError, setActionError] = useState('')
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Common.RequestCard')
  const tStatus = useTranslations('Common.RequestStatus')

  const myPickupConfirmedAt = role === 'owner' ? req.pickup_confirmed_by_owner_at : req.pickup_confirmed_by_requester_at
  const myReturnConfirmedAt = role === 'owner' ? req.return_confirmed_by_owner_at : req.return_confirmed_by_requester_at

  const act = async (action: () => Promise<unknown>, key: string) => {
    setLoading(key)
    setActionError('')
    try {
      await action()
      onUpdate()
    } catch (e: any) {
      setActionError(e.response?.data?.detail || t('errorConfirming'))
    } finally {
      setLoading(null)
    }
  }

  // Confirming return is the only moment the owner can still open a
  // claim (see claim_service.create_claim's filing window) — the prompt
  // fires right after their own confirmation succeeds, whether or not
  // the other side has confirmed too, and whether it's a mutual confirm
  // or the force-return escape hatch.
  const confirmReturn = async (action: () => Promise<unknown>, key: string) => {
    setLoading(key)
    setActionError('')
    try {
      await action()
      // Deliberately NOT calling onUpdate() here when the prompt is about
      // to show — onUpdate() (loadAll in the dashboard) flips a `loading`
      // flag that unmounts this whole list while refetching, which would
      // wipe showReturnPrompt/showClaim before the user ever saw them.
      // It's called instead once the prompt/modal interaction concludes
      // (see the prompt buttons and ClaimModal's onClose/onSuccess below).
      if (role === 'owner' && req.declared_value != null) {
        setShowReturnPrompt(true)
      } else {
        onUpdate()
      }
    } catch (e: any) {
      setActionError(e.response?.data?.detail || t('errorConfirming'))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-surface rounded-panel border border-border shadow-subtle p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-ink-subtle flex-shrink-0" />
            <span className="font-medium text-ink truncate">{req.item_title}</span>
          </div>
          <p className="text-xs text-ink-muted">
            {role === 'requester' ? t('owner', { name: req.owner_name }) : t('requester', { name: req.requester_name })}
          </p>
          {(() => {
            const phone = role === 'requester' ? req.owner_phone : req.requester_phone
            return phone ? (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1 text-xs font-mono tabular-nums text-primary hover:text-primary-hover mt-0.5"
              >
                <Phone className="w-3 h-3" /> {phone}
              </a>
            ) : null
          })()}
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Badge variant={STATUS_COLORS[req.status]}>
            {tStatus(req.status)}
          </Badge>
          {req.payment_status !== 'unpaid' && PAYMENT_STATUS_KEYS[req.payment_status] && (
            <Badge variant={PAYMENT_STATUS_COLORS[req.payment_status]}>
              {t(`paymentStatus.${PAYMENT_STATUS_KEYS[req.payment_status]}`)}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-muted mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {t.rich('pickup', { date: formatDate(req.pickup_date, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })}
        </span>
        <span>{t.rich('returnDate', { date: formatDate(req.expected_return_date, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })}</span>
      </div>

      {req.notes && (
        <p className="text-sm text-ink-muted bg-surface-2 rounded-control p-3 mb-4">&ldquo;{req.notes}&rdquo;</p>
      )}

      {req.extension_status === 'pending' && req.requested_extension_date && (
        <div className="flex items-start gap-2 bg-info-subtle border border-info/30 rounded-control p-3 mb-4">
          <CalendarClock className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-info">
              {role === 'owner'
                ? t.rich('extensionRequestedOwner', { date: formatDate(req.requested_extension_date, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })
                : t.rich('extensionRequestedRequester', { date: formatDate(req.requested_extension_date, locale), d: (chunks) => <span className="font-mono tabular-nums">{chunks}</span> })}
            </p>
            {role === 'owner' && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" loading={loading === 'approveExt'} onClick={() => act(() => requestsService.approveExtension(req.id), 'approveExt')}>
                  <Check className="w-3.5 h-3.5" /> {t('approve')}
                </Button>
                <Button size="sm" variant="outline" loading={loading === 'rejectExt'} onClick={() => act(() => requestsService.rejectExtension(req.id), 'rejectExt')}>
                  <XIcon className="w-3.5 h-3.5" /> {t('reject')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {role === 'requester' && req.status === 'accepted' && req.payment_status === 'processing' && (
        <div className="mb-4">
          <PixCheckout requestId={req.id} onConfirmed={onUpdate} />
        </div>
      )}

      {role === 'requester' && req.has_pending_extension_payment && (
        <div className="mb-4">
          <ExtensionPixCheckout requestId={req.id} onConfirmed={onUpdate} />
        </div>
      )}

      {role === 'requester' && req.claim_status && CLAIM_STATUSES_WITH_PENDING_CHARGE.includes(req.claim_status) && (
        <div className="mb-4">
          <ClaimPixCheckout requestId={req.id} onConfirmed={onUpdate} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {role === 'owner' && req.status === 'pending' && (
          <>
            <Button size="sm" loading={loading === 'accept'} onClick={() => act(() => requestsService.accept(req.id), 'accept')}>
              {t('accept')}
            </Button>
            <Button size="sm" variant="danger" loading={loading === 'refuse'} onClick={() => act(() => requestsService.refuse(req.id), 'refuse')}>
              {t('refuse')}
            </Button>
          </>
        )}

        {req.status === 'accepted' && (
          req.payment_status === 'processing' ? (
            role === 'owner' && (
              <span className="text-xs text-warning self-center">
                {t('waitingForPayment')}
              </span>
            )
          ) : req.fulfillment_method === 'delivery' ? (
            role === 'owner' ? (
              <DeliveryCodeConfirm request={req} onConfirmed={onUpdate} />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">{t('deliveryCodeRequesterHint')}</span>
                <span className="text-2xl font-bold tracking-[0.3em] text-primary">
                  {req.delivery_confirmation_code}
                </span>
              </div>
            )
          ) : myPickupConfirmedAt ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-primary self-center">
                {role === 'owner' ? t('pickupConfirmedWaitingRequester') : t('pickupConfirmedWaitingOwner')}
              </span>
              {role === 'owner' && (
                <Button size="sm" variant="outline" loading={loading === 'forceStart'} onClick={() => act(() => requestsService.startForce(req.id), 'forceStart')}>
                  {t('forcePickup')}
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" variant="secondary" loading={loading === 'start'} onClick={() => act(() => requestsService.start(req.id), 'start')}>
              {t('confirmPickup')}
            </Button>
          )
        )}

        {req.status === 'in_progress' && !showReturnPrompt && (
          myReturnConfirmedAt ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-primary self-center">
                {role === 'owner' ? t('returnConfirmedWaitingRequester') : t('returnConfirmedWaitingOwner')}
              </span>
              {role === 'owner' && (
                <Button size="sm" variant="outline" loading={loading === 'forceFinish'} onClick={() => confirmReturn(() => requestsService.finishForce(req.id), 'forceFinish')}>
                  {t('forceReturn')}
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" loading={loading === 'finish'} onClick={() => confirmReturn(() => requestsService.finish(req.id), 'finish')}>
              {t('confirmReturn')}
            </Button>
          )
        )}

        {showReturnPrompt && role === 'owner' && req.declared_value != null && (
          <div className="w-full bg-surface-2 rounded-control p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink flex-1 min-w-0">{t('anyProblemWithItem')}</span>
            <Button size="sm" variant="outline" onClick={() => { setShowReturnPrompt(false); onUpdate() }}>
              {t('noProblem')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => { setShowReturnPrompt(false); setShowClaim(true) }}>
              {t('yesProblem')}
            </Button>
          </div>
        )}

        {(req.status === 'pending' || req.status === 'accepted') && (
          <Button size="sm" variant="outline" loading={loading === 'cancel'} onClick={() => act(() => requestsService.cancel(req.id), 'cancel')}>
            {t('cancel')}
          </Button>
        )}

        {req.status === 'finished' && (
          <Button size="sm" variant="secondary" onClick={() => setShowReview(true)}>
            {t('review')}
          </Button>
        )}

        {req.claim_id && (
          <Badge variant={CLAIM_STATUS_COLORS[req.claim_status ?? 'pending']}>
            {t(`claimStatus.${req.claim_status ?? 'pending'}`)}
          </Badge>
        )}

        {role === 'requester' && req.status === 'in_progress' && req.extension_status !== 'pending' && (
          <Button size="sm" variant="outline" onClick={() => setShowExtension(true)}>
            <CalendarClock className="w-3.5 h-3.5" /> {t('requestExtension')}
          </Button>
        )}

        <Link
          href={`/requests/${req.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-muted hover:text-primary-hover hover:bg-primary-subtle rounded-control transition-colors"
        >
          <MessageCircle className="w-4 h-4" /> {t('viewConversation')}
        </Link>
      </div>

      {actionError && (
        <p className="text-xs text-danger mt-2">{actionError}</p>
      )}

      {showReview && (
        <ReviewModal
          requestId={req.id}
          reviewedName={role === 'requester' ? req.owner_name : req.requester_name}
          onClose={() => setShowReview(false)}
          onSuccess={() => { setShowReview(false); onUpdate() }}
        />
      )}

      {showExtension && (
        <ExtensionModal
          requestId={req.id}
          itemId={req.item_id}
          currentExpectedReturnDate={req.expected_return_date}
          onClose={() => setShowExtension(false)}
          onSuccess={() => { setShowExtension(false); onUpdate() }}
        />
      )}

      {showClaim && req.declared_value != null && (
        <ClaimModal
          requestId={req.id}
          declaredValue={req.declared_value}
          onClose={() => setShowClaim(false)}
          onSuccess={() => { setShowClaim(false); onUpdate() }}
        />
      )}
    </div>
  )
}
