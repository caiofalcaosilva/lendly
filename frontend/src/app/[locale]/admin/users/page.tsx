'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Users, Search, Ban, CheckCircle2, Building2, ShieldPlus, ShieldMinus, Eye } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminUserSummary } from '@/types'
import { adminUsersService } from '@/services/adminUsers'
import { viewAsService } from '@/services/viewAs'
import { startViewAs } from '@/lib/tokenStorage'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'
import { TableShell, TableHeadRow, TableRow } from '@/components/ui/Table'
import Checkbox from '@/components/ui/Checkbox'
import Tooltip from '@/components/ui/Tooltip'

const LIMIT = 20

function SkeletonRow() {
  return (
    <TableRow>
      <td className="px-4 py-3"><Skeleton className="w-4 h-4" /></td>
      <td className="px-4 py-3 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
      </td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><div className="flex justify-end"><Skeleton className="h-8 w-8" /></div></td>
    </TableRow>
  )
}

export default function AdminUsersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<{ text: string; hasFailures: boolean } | null>(null)
  const [bulkConfirmAction, setBulkConfirmAction] = useState<'activate' | 'deactivate' | null>(null)
  const [adminConfirmTarget, setAdminConfirmTarget] = useState<AdminUserSummary | null>(null)
  const skipRef = useRef(0)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Admin.Users')

  const selectableUsers = users.filter((u) => !u.is_admin)
  const allSelectableSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selected.has(u.id))

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(allSelectableSelected ? new Set() : new Set(selectableUsers.map((u) => u.id)))
  }

  const runBulkAction = async (action: 'activate' | 'deactivate') => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setBulkLoading(true)
    setBulkMessage(null)
    try {
      const result = action === 'activate'
        ? await adminUsersService.bulkActivate(ids)
        : await adminUsersService.bulkDeactivate(ids)
      setUsers((prev) => prev.map((u) =>
        result.succeeded.includes(u.id) ? { ...u, is_active: action === 'activate' } : u,
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
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const load = useCallback((searchTerm: string) => {
    if (!user?.is_admin) return
    setLoading(true)
    setError('')
    skipRef.current = 0
    adminUsersService.list({ search: searchTerm || undefined, skip: 0, limit: LIMIT })
      .then((data) => {
        setUsers(data)
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
      const data = await adminUsersService.list({ search: search || undefined, skip: skipRef.current, limit: LIMIT })
      setUsers((prev) => [...prev, ...data])
      skipRef.current += data.length
      setHasMore(data.length === LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleActive = async (target: AdminUserSummary) => {
    setBusy(target.id)
    setError('')
    try {
      const updated = target.is_active
        ? await adminUsersService.deactivate(target.id)
        : await adminUsersService.activate(target.id)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorUpdatingUser'))
    } finally {
      setBusy(null)
    }
  }

  const viewAs = async (target: AdminUserSummary) => {
    setBusy(target.id)
    setError('')
    try {
      const { access_token, user: targetUser } = await viewAsService.start(target.id)
      startViewAs(access_token, targetUser.id)
      window.location.href = '/dashboard'
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorViewAs'))
      setBusy(null)
    }
  }

  const toggleAdmin = async (target: AdminUserSummary) => {
    setBusy(target.id)
    setError('')
    try {
      const updated = target.is_admin
        ? await adminUsersService.demote(target.id)
        : await adminUsersService.promote(target.id)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorUpdatingAdminLevel'))
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
        <Users className="w-6 h-6 text-info" />
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

      {!loading && users.length === 0 ? (
        <EmptyState icon={Users} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <TableShell>
            <TableHeadRow>
              <th className="px-4 py-3 font-medium w-8">
                {!loading && (
                  <Checkbox checked={allSelectableSelected} onChange={toggleSelectAll} />
                )}
              </th>
              <th className="px-4 py-3 font-medium">{t('columnUser')}</th>
              <th className="px-4 py-3 font-medium">{t('columnCity')}</th>
              <th className="px-4 py-3 font-medium">{t('columnSignup')}</th>
              <th className="px-4 py-3 font-medium">{t('columnStatus')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('columnAction')}</th>
            </TableHeadRow>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : users.map((u) => (
                  <TableRow key={u.id}>
                    <td className="px-4 py-3">
                      {!u.is_admin && (
                        <Checkbox checked={selected.has(u.id)} onChange={() => toggleSelected(u.id)} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="font-medium text-ink hover:text-primary transition-colors flex items-center gap-1.5">
                        {u.account_type === 'business' && <Building2 className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />}
                        {u.trade_name || u.name}
                      </Link>
                      <div className="text-xs text-ink-subtle">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {[u.neighborhood, u.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted font-mono tabular-nums">{formatDate(u.created_at, locale)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={u.is_active ? 'green' : 'red'}>{u.is_active ? t('statusActive') : t('statusInactive')}</Badge>
                        {u.is_admin && <Badge variant="purple">{t('adminBadge')}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!u.is_admin && (
                          <Tooltip label={t('viewAs')}>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy === u.id}
                              onClick={() => viewAs(u)}
                              aria-label={t('viewAs')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        )}
                        {!u.is_admin && (
                          <Button
                            size="sm"
                            variant={u.is_active ? 'danger' : 'outline'}
                            loading={busy === u.id}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? <><Ban className="w-3.5 h-3.5" /> {t('deactivate')}</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('activate')}</>}
                          </Button>
                        )}
                        {u.id === user?.id ? (
                          <span className="text-xs text-ink-subtle self-center">—</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === u.id}
                            onClick={() => setAdminConfirmTarget(u)}
                          >
                            {u.is_admin ? <><ShieldMinus className="w-3.5 h-3.5" /> {t('removeAdmin')}</> : <><ShieldPlus className="w-3.5 h-3.5" /> {t('promote')}</>}
                          </Button>
                        )}
                      </div>
                    </td>
                  </TableRow>
                ))}
            </tbody>
          </TableShell>

          {!loading && hasMore && (
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

      <ConfirmDialog
        open={adminConfirmTarget !== null}
        onClose={() => setAdminConfirmTarget(null)}
        onConfirm={() => {
          const target = adminConfirmTarget
          setAdminConfirmTarget(null)
          if (target) toggleAdmin(target)
        }}
        title={adminConfirmTarget?.is_admin ? t('removeAdmin') : t('promote')}
        description={
          adminConfirmTarget
            ? adminConfirmTarget.is_admin
              ? t('confirmDemote', { name: adminConfirmTarget.trade_name || adminConfirmTarget.name })
              : t('confirmPromote', { name: adminConfirmTarget.trade_name || adminConfirmTarget.name })
            : ''
        }
        confirmLabel={adminConfirmTarget?.is_admin ? t('removeAdmin') : t('promote')}
        variant={adminConfirmTarget?.is_admin ? 'danger' : 'primary'}
        loading={busy === adminConfirmTarget?.id}
      />
    </div>
  )
}
