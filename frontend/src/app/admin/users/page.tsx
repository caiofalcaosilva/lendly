'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Search, Ban, CheckCircle2, Building2, ShieldPlus, ShieldMinus, Eye } from 'lucide-react'
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

const LIMIT = 20

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
  const skipRef = useRef(0)

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
    const participle = action === 'activate' ? 'ativado(s)' : 'desativado(s)'
    if (!window.confirm(`${action === 'activate' ? 'Ativar' : 'Desativar'} ${ids.length} usuário(s) selecionado(s)?`)) return
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
        setBulkMessage({
          text: `${result.succeeded.length} usuário(s) ${participle}, ${result.failed.length} falharam: ${result.failed.map((f) => f.reason).join('; ')}`,
          hasFailures: true,
        })
      } else {
        setBulkMessage({ text: `${result.succeeded.length} usuário(s) ${participle} com sucesso.`, hasFailures: false })
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
      setError(e.response?.data?.detail || 'Erro ao atualizar usuário')
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
      setError(e.response?.data?.detail || 'Erro ao entrar no modo "ver como"')
      setBusy(null)
    }
  }

  const toggleAdmin = async (target: AdminUserSummary) => {
    const message = target.is_admin
      ? `Remover privilégios de admin de ${target.trade_name || target.name}?`
      : `Tornar ${target.trade_name || target.name} um administrador? A conta perderá acesso a anunciar e alugar itens.`
    if (!window.confirm(message)) return
    setBusy(target.id)
    setError('')
    try {
      const updated = target.is_admin
        ? await adminUsersService.demote(target.id)
        : await adminUsersService.promote(target.id)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao atualizar nível de admin')
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
        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gerenciamento de usuários</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Busque, ative ou desative contas.
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou razão social..."
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
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">{selected.size} selecionado(s)</span>
          <Button size="sm" variant="outline" loading={bulkLoading} onClick={() => runBulkAction('activate')}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Ativar selecionados
          </Button>
          <Button size="sm" variant="danger" loading={bulkLoading} onClick={() => runBulkAction('deactivate')}>
            <Ban className="w-3.5 h-3.5" /> Desativar selecionados
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Tente ajustar sua busca." />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-green-600"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-4 py-3">
                      {!u.is_admin && (
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleSelected(u.id)}
                          className="w-4 h-4 rounded accent-green-600"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors flex items-center gap-1.5">
                        {u.account_type === 'business' && <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        {u.trade_name || u.name}
                      </Link>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {[u.neighborhood, u.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Ativo' : 'Desativado'}</Badge>
                        {u.is_admin && <Badge variant="purple">Admin</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!u.is_admin && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === u.id}
                            onClick={() => viewAs(u)}
                            title="Ver como"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!u.is_admin && (
                          <Button
                            size="sm"
                            variant={u.is_active ? 'danger' : 'outline'}
                            loading={busy === u.id}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? <><Ban className="w-3.5 h-3.5" /> Desativar</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Ativar</>}
                          </Button>
                        )}
                        {u.id === user?.id ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500 self-center">—</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy === u.id}
                            onClick={() => toggleAdmin(u)}
                          >
                            {u.is_admin ? <><ShieldMinus className="w-3.5 h-3.5" /> Remover admin</> : <><ShieldPlus className="w-3.5 h-3.5" /> Promover</>}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
