'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Package, Search, Ban, CheckCircle2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminItemSummary, Category } from '@/types'
import { adminItemsService } from '@/services/adminItems'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, getCategoryLabel } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'

const LIMIT = 20

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3"><Skeleton className="w-4 h-4" /></td>
      <td className="px-4 py-3 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><div className="flex justify-end"><Skeleton className="h-8 w-8" /></div></td>
    </tr>
  )
}

export default function AdminItemsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<AdminItemSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<{ text: string; hasFailures: boolean } | null>(null)
  const [bulkConfirmAction, setBulkConfirmAction] = useState<'activate' | 'deactivate' | null>(null)
  const skipRef = useRef(0)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Items')

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  const runBulkAction = async (action: 'activate' | 'deactivate') => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setBulkLoading(true)
    setBulkMessage(null)
    try {
      const result = action === 'activate'
        ? await adminItemsService.bulkActivate(ids)
        : await adminItemsService.bulkDeactivate(ids)
      setItems((prev) => prev.map((i) =>
        result.succeeded.includes(i.id) ? { ...i, is_active: action === 'activate' } : i,
      ))
      setSelected(new Set())
      if (result.failed.length > 0) {
        const params = {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          reasons: result.failed.map((f) => f.reason).join('; '),
        }
        setBulkMessage({
          text: action === 'activate' ? t('activatedWithFailures', params) : t('deactivatedWithFailures', params),
          hasFailures: true,
        })
      } else {
        setBulkMessage({
          text: action === 'activate' ? t('activatedSuccess', { count: result.succeeded.length }) : t('deactivatedSuccess', { count: result.succeeded.length }),
          hasFailures: false,
        })
      }
    } finally {
      setBulkLoading(false)
    }
  }

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback((searchTerm: string) => {
    if (!user?.is_admin) return
    setLoading(true)
    setError('')
    skipRef.current = 0
    adminItemsService.list({ search: searchTerm || undefined, skip: 0, limit: LIMIT })
      .then((data) => {
        setItems(data)
        skipRef.current = data.length
        setHasMore(data.length === LIMIT)
      })
      .finally(() => setLoading(false))
  }, [user?.is_admin])

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 350 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, user?.is_admin])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await adminItemsService.list({ search: search || undefined, skip: skipRef.current, limit: LIMIT })
      setItems((prev) => [...prev, ...data])
      skipRef.current += data.length
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleActive = async (target: AdminItemSummary) => {
    setBusy(target.id)
    setError('')
    try {
      const updated = target.is_active
        ? await adminItemsService.deactivate(target.id)
        : await adminItemsService.activate(target.id)
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorUpdatingItem'))
    } finally {
      setBusy(null)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-primary" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-6 h-6 text-info" />
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
      </div>
      <p className="text-ink-muted text-sm mb-6">
        {t('subtitle')}
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-surface text-ink border border-border rounded-panel text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
          {error}
        </div>
      )}

      {bulkMessage && (
        <div className={`mb-4 p-3 border rounded-control text-sm ${
          bulkMessage.hasFailures
            ? 'bg-warning-subtle border-warning/30 text-warning'
            : 'bg-primary-subtle border-primary/30 text-primary'
        }`}>
          {bulkMessage.text}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-info-subtle border border-info/30 rounded-control">
          <span className="text-sm text-info font-medium">{t('selectedCount', { count: selected.size })}</span>
          <Button size="sm" variant="outline" loading={bulkLoading} onClick={() => setBulkConfirmAction('activate')}>
            <CheckCircle2 className="w-3.5 h-3.5" /> {t('activateSelected')}
          </Button>
          <Button size="sm" variant="danger" loading={bulkLoading} onClick={() => setBulkConfirmAction('deactivate')}>
            <Ban className="w-3.5 h-3.5" /> {t('deactivateSelected')}
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-info hover:underline"
          >
            {t('clearSelection')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-surface rounded-panel border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-subtle uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium w-8" />
                  <th className="px-4 py-3 font-medium">{t('columnItem')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnOwner')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnCity')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnSignup')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('columnAction')}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="bg-surface rounded-panel border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-subtle uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">{t('columnItem')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnOwner')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnCity')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnSignup')}</th>
                  <th className="px-4 py-3 font-medium">{t('columnStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('columnAction')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggleSelected(it.id)}
                        className="w-4 h-4 rounded accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/items/${it.id}`} className="font-medium text-ink hover:text-primary transition-colors">
                        {it.title}
                      </Link>
                      <div className="text-xs text-ink-subtle">{getCategoryLabel(categories, it.category)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${it.owner_id}`} className="text-ink-muted hover:text-primary transition-colors">
                        {it.owner_name}
                      </Link>
                      <div className="text-xs text-ink-subtle">{it.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {[it.neighborhood, it.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(it.created_at, locale)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={it.is_active ? 'green' : 'red'}>{it.is_active ? t('statusActive') : t('statusInactive')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={it.is_active ? 'danger' : 'outline'}
                        loading={busy === it.id}
                        onClick={() => toggleActive(it)}
                      >
                        {it.is_active ? <><Ban className="w-3.5 h-3.5" /> {t('deactivate')}</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('activate')}</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={bulkConfirmAction !== null}
        onClose={() => setBulkConfirmAction(null)}
        onConfirm={() => {
          const action = bulkConfirmAction
          setBulkConfirmAction(null)
          if (action) runBulkAction(action)
        }}
        title={bulkConfirmAction === 'activate' ? t('activateSelected') : t('deactivateSelected')}
        description={
          bulkConfirmAction === 'activate'
            ? t('confirmActivate', { count: selected.size })
            : t('confirmDeactivate', { count: selected.size })
        }
        confirmLabel={bulkConfirmAction === 'activate' ? t('activate') : t('deactivate')}
        variant={bulkConfirmAction === 'activate' ? 'primary' : 'danger'}
        loading={bulkLoading}
      />
    </div>
  )
}
