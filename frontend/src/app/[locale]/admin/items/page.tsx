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

const LIMIT = 20

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
    const confirmMessage = action === 'activate'
      ? t('confirmActivate', { count: ids.length })
      : t('confirmDeactivate', { count: ids.length })
    if (!window.confirm(confirmMessage)) return
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
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('subtitle')}
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {bulkMessage && (
        <div className={`mb-4 p-3 border rounded-lg text-sm ${
          bulkMessage.hasFailures
            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
        }`}>
          {bulkMessage.text}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">{t('selectedCount', { count: selected.size })}</span>
          <Button size="sm" variant="outline" loading={bulkLoading} onClick={() => runBulkAction('activate')}>
            <CheckCircle2 className="w-3.5 h-3.5" /> {t('activateSelected')}
          </Button>
          <Button size="sm" variant="danger" loading={bulkLoading} onClick={() => runBulkAction('deactivate')}>
            <Ban className="w-3.5 h-3.5" /> {t('deactivateSelected')}
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('clearSelection')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-green-600"
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
                  <tr key={it.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggleSelected(it.id)}
                        className="w-4 h-4 rounded accent-green-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/items/${it.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                        {it.title}
                      </Link>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{getCategoryLabel(categories, it.category)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${it.owner_id}`} className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                        {it.owner_name}
                      </Link>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{it.owner_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {[it.neighborhood, it.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(it.created_at, locale)}</td>
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
    </div>
  )
}
