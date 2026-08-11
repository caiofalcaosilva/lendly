'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/navigation'
import {
  MapPin, Star, Tag, Package, AlertTriangle, ArrowLeft, Edit, Trash2, Flag, BellRing, BellOff, CalendarDays, ShieldCheck,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Category, Item } from '@/types'
import { itemsService } from '@/services/items'
import { categoriesService } from '@/services/categories'
import { getCategoryLabel, getSubcategoryLabel, formatCurrency, formatDate, haversineKm } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import BusinessBadge from '@/components/ui/BusinessBadge'
import RequestModal from '@/components/requests/RequestModal'
import ReportModal from '@/components/reports/ReportModal'
import ItemCard from '@/components/items/ItemCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/contexts/ToastContext'

const SIMILAR_LIMIT = 4
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

async function loadSimilarItems(item: Item): Promise<Item[]> {
  const dedup = new Map<string, Item>()

  const add = async (params: { category: string; subcategory?: string }) => {
    if (dedup.size >= SIMILAR_LIMIT) return
    const results = await itemsService.list({ ...params, limit: 12 } as any)
    for (const it of results) {
      if (it.id !== item.id) dedup.set(it.id, it)
    }
  }

  // Same category + subcategory first (closest match), then broaden to the
  // whole category if that wasn't enough to fill the section.
  if (item.subcategory) {
    await add({ category: item.category, subcategory: item.subcategory })
  }
  if (dedup.size < SIMILAR_LIMIT) {
    await add({ category: item.category })
  }

  const candidates = Array.from(dedup.values())

  if (item.latitude != null && item.longitude != null) {
    candidates.sort((a, b) => {
      const da = a.latitude != null && a.longitude != null
        ? haversineKm(item.latitude!, item.longitude!, a.latitude, a.longitude) : Infinity
      const db = b.latitude != null && b.longitude != null
        ? haversineKm(item.latitude!, item.longitude!, b.latitude, b.longitude) : Infinity
      return da - db
    })
  }

  return candidates.slice(0, SIMILAR_LIMIT)
}

export default function ItemDetailClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Items.Id')
  const toast = useToast()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequest, setShowRequest] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [similarItems, setSimilarItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    setSimilarItems([])
    itemsService.get(id).then(setItem).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!item) return
    let cancelled = false
    loadSimilarItems(item).then((results) => { if (!cancelled) setSimilarItems(results) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `item` intentionally narrowed to id/category/subcategory: refetch only when those change, not on unrelated item updates (e.g. photos, description)
  }, [item?.id, item?.category, item?.subcategory])

  const isOwner = user?.id === item?.owner.id

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await itemsService.delete(id)
      router.push('/dashboard')
    } catch {
      toast.error(t('errorDeleting'))
      setDeleting(false)
    }
  }

  const toggleWaitlist = async () => {
    if (!item) return
    setWaitlistLoading(true)
    try {
      const updated = item.is_waitlisted
        ? await itemsService.leaveWaitlist(item.id)
        : await itemsService.joinWaitlist(item.id)
      setItem(updated)
    } finally {
      setWaitlistLoading(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner className="w-8 h-8 text-primary" />
    </div>
  )

  if (!item) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <Package className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
      <h1 className="text-xl font-semibold text-ink-muted">{t('notFound')}</h1>
      <Link href="/items" className="text-primary text-sm mt-3 inline-block">← {t('backToItems')}</Link>
    </div>
  )

  const photos = item.photos?.filter(Boolean) ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/items" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('backToItems')}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Photos */}
        <div>
          <div className="relative aspect-[4/3] bg-surface-2 rounded-panel overflow-hidden">
            {photos.length > 0 ? (
              <Image
                src={photos[activePhoto]}
                alt={item.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="w-16 h-16 text-ink-subtle" />
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 mt-3">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`relative w-16 h-16 rounded-control overflow-hidden border-2 transition-colors ${i === activePhoto ? 'border-primary' : 'border-transparent'}`}
                >
                  <Image src={photo} alt="" fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="gray">
                  {getCategoryLabel(categories, item.category)}
                  {getSubcategoryLabel(categories, item.category, item.subcategory) && (
                    ` · ${getSubcategoryLabel(categories, item.category, item.subcategory)}`
                  )}
                </Badge>
                {item.availability_type === 'free' ? (
                  <Badge variant="green">{t('free')}</Badge>
                ) : (
                  <Badge variant="blue">{t('rental')}</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-ink">{item.title}</h1>
            </div>
            {isOwner && (
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/items/${item.id}/edit`}>
                  <Button size="sm" variant="outline" aria-label={t('Edit.title')}><Edit className="w-4 h-4" /></Button>
                </Link>
                <Button size="sm" variant="danger" loading={deleting} onClick={() => setShowDeleteConfirm(true)} aria-label={t('confirmDeleteTitle')}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {item.availability_type === 'paid' && item.daily_rate && (
            <div className="text-2xl font-bold text-primary mb-4">
              {formatCurrency(item.daily_rate, locale)}<span className="text-base font-normal text-ink-muted">{t('perDay')}</span>
            </div>
          )}

          {(item.neighborhood || item.city) && (
            <div className="flex items-center gap-1.5 text-ink-muted text-sm mb-5">
              <MapPin className="w-4 h-4" />
              {[item.neighborhood, item.city].filter(Boolean).join(', ')}
            </div>
          )}

          {item.description && (
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-ink-muted mb-2">{t('description')}</h2>
              <p className="text-ink-muted text-sm leading-relaxed">{item.description}</p>
            </div>
          )}

          {item.available_days && item.available_days.length > 0 && (
            <div className="flex items-center gap-1.5 text-ink-muted text-sm mb-5">
              <CalendarDays className="w-4 h-4" />
              {t('availableOn', { days: item.available_days.map((d) => t(`weekdays.${WEEKDAY_KEYS[d]}`)).join(', ') })}
            </div>
          )}

          {item.usage_rules && (
            <div className="mb-5 p-4 bg-warning-subtle border border-warning/30 rounded-panel">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h2 className="text-sm font-semibold text-warning">{t('usageRules')}</h2>
              </div>
              <p className="text-sm text-warning">{item.usage_rules}</p>
            </div>
          )}

          {/* Owner */}
          <div className="border border-border rounded-panel p-4 mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-muted mb-0.5">{t('listedBy')}</p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link href={`/users/${item.owner.id}`} className="font-medium text-ink hover:text-primary transition-colors truncate">
                    {item.owner.trade_name || item.owner.name}
                  </Link>
                  <BusinessBadge accountType={item.owner.account_type} />
                </div>
                {item.owner.city && (
                  <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[item.owner.neighborhood, item.owner.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold text-ink">{item.owner.average_rating.toFixed(1)}</span>
                </div>
                <ReliabilityBadge score={item.owner.reliability_score} count={item.owner.reliability_count} size="md" />
              </div>
            </div>
          </div>

          {!isOwner && !user?.is_admin && (
            <div>
              {!isAuthenticated ? (
                <Link href={`/login?redirect=/items/${item.id}`}>
                  <Button className="w-full" size="lg">
                    {t('loginToRequest')}
                  </Button>
                </Link>
              ) : !item.is_available ? (
                <div className="space-y-2">
                  <div className="bg-surface-2 text-ink-muted text-center py-3 px-4 rounded-control text-sm">
                    {t('temporarilyUnavailable')}
                  </div>
                  <Button
                    variant={item.is_waitlisted ? 'outline' : 'secondary'}
                    className="w-full"
                    loading={waitlistLoading}
                    onClick={toggleWaitlist}
                  >
                    {item.is_waitlisted ? (
                      <><BellOff className="w-4 h-4" /> {t('cancelNotify')}</>
                    ) : (
                      <><BellRing className="w-4 h-4" /> {t('notifyWhenAvailable')}</>
                    )}
                  </Button>
                </div>
              ) : item.requires_identity_verification && user?.identity_status !== 'approved' ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-warning-subtle border border-warning/30 rounded-control p-3 text-sm text-warning">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {t('requiresVerification')}
                  </div>
                  <Link href="/profile#identity-verification">
                    <Button className="w-full" size="lg">
                      {user?.identity_status === 'pending' ? t('verificationPending') : t('verifyIdentity')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button className="w-full" size="lg" onClick={() => setShowRequest(true)}>
                  {item.availability_type === 'free' ? t('requestLoan') : t('requestRental')}
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-ink-subtle">
              {t('publishedOn', { date: formatDate(item.created_at, locale) })}
            </p>
            {isAuthenticated && !isOwner && (
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-1 text-xs text-ink-subtle hover:text-danger transition-colors"
              >
                <Flag className="w-3 h-3" /> {t('report')}
              </button>
            )}
          </div>
        </div>
      </div>

      {similarItems.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-ink mb-4">{t('similarItems')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {similarItems.map((similar) => (
              <ItemCard key={similar.id} item={similar} />
            ))}
          </div>
        </div>
      )}

      {showRequest && (
        <RequestModal item={item} onClose={() => setShowRequest(false)} />
      )}

      {showReport && (
        <ReportModal
          itemId={item.id}
          targetLabel={t('reportTargetLabel')}
          onClose={() => setShowReport(false)}
          onSuccess={() => { setShowReport(false); toast.success(t('reportSent')) }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete() }}
        title={t('confirmDeleteTitle')}
        description={t('confirmDelete')}
        loading={deleting}
      />
    </div>
  )
}
