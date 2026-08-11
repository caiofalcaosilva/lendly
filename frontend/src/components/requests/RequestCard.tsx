'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Calendar, MessageCircle, Package, CalendarClock, Check, X as XIcon, Phone } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { LoanRequest, PaymentStatus } from '@/types'
import { requestsService } from '@/services/requests'
import { formatDate } from '@/lib/utils'
import Badge, { STATUS_COLORS } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ReviewModal from '@/components/reviews/ReviewModal'
import ExtensionModal from '@/components/requests/ExtensionModal'
import PixCheckout from '@/components/requests/PixCheckout'

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

  return (
    <div className="bg-surface rounded-panel border border-border p-5">
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
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover mt-0.5"
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
          {t('pickup', { date: formatDate(req.pickup_date, locale) })}
        </span>
        <span>{t('returnDate', { date: formatDate(req.expected_return_date, locale) })}</span>
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
                ? t('extensionRequestedOwner', { date: formatDate(req.requested_extension_date, locale) })
                : t('extensionRequestedRequester', { date: formatDate(req.requested_extension_date, locale) })}
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

        {req.status === 'in_progress' && (
          myReturnConfirmedAt ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-primary self-center">
                {role === 'owner' ? t('returnConfirmedWaitingRequester') : t('returnConfirmedWaitingOwner')}
              </span>
              {role === 'owner' && (
                <Button size="sm" variant="outline" loading={loading === 'forceFinish'} onClick={() => act(() => requestsService.finishForce(req.id), 'forceFinish')}>
                  {t('forceReturn')}
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" loading={loading === 'finish'} onClick={() => act(() => requestsService.finish(req.id), 'finish')}>
              {t('confirmReturn')}
            </Button>
          )
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
          currentExpectedReturnDate={req.expected_return_date}
          onClose={() => setShowExtension(false)}
          onSuccess={() => { setShowExtension(false); onUpdate() }}
        />
      )}
    </div>
  )
}
