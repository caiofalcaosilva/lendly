'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, Inbox, Send, History, Plus, Edit, Eye, EyeOff, Star, AlertCircle, RefreshCw,
} from 'lucide-react'
import ReviewCard from '@/components/reviews/ReviewCard'
import { Item, LoanRequest, Review } from '@/types'
import { itemsService } from '@/services/items'
import { requestsService } from '@/services/requests'
import { reviewsService } from '@/services/reviews'
import { useAuth } from '@/contexts/AuthContext'
import { getCategoryLabel, formatCurrency, formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge, { STATUS_COLORS } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import RequestCard from '@/components/requests/RequestCard'
import { REQUEST_STATUS_LABELS } from '@/types'

type Tab = 'items' | 'received' | 'sent' | 'history'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'items', label: 'Meus itens', icon: Package },
  { id: 'received', label: 'Recebidas', icon: Inbox },
  { id: 'sent', label: 'Enviadas', icon: Send },
  { id: 'history', label: 'Histórico', icon: History },
]

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('items')
  const [items, setItems] = useState<Item[]>([])
  const [received, setReceived] = useState<LoanRequest[]>([])
  const [sent, setSent] = useState<LoanRequest[]>([])
  const [history, setHistory] = useState<LoanRequest[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setLoadError(null)
    try {
      const [myItems, recv, snt, hist] = await Promise.all([
        itemsService.myItems(),
        requestsService.received(),
        requestsService.sent(),
        requestsService.history(),
      ])
      setItems(myItems)
      setReceived(recv)
      setSent(snt)
      setHistory(hist)
      if (user) {
        reviewsService.forUser(user.id).then(setReviews).catch(() => {})
      }
    } catch (e: any) {
      if (!e.response) {
        setLoadError('Não foi possível conectar ao servidor. Verifique se a API está rodando em http://localhost:8000.')
      } else {
        setLoadError(e.response?.data?.detail || `Erro ao carregar dados (${e.response?.status})`)
      }
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => { loadAll() }, [loadAll])

  const toggleAvailability = async (item: Item) => {
    setToggling(item.id)
    try {
      if (item.is_available) await itemsService.deactivate(item.id)
      else await itemsService.activate(item.id)
      loadAll()
    } finally {
      setToggling(null)
    }
  }

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner /></div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.name.split(' ')[0]} 👋</h1>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm text-gray-600">
              {user?.average_rating.toFixed(1)} ({user?.rating_count} avaliações)
            </span>
          </div>
        </div>
        <Link href="/items/new">
          <Button>
            <Plus className="w-4 h-4" /> Anunciar item
          </Button>
        </Link>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700 font-medium">Erro ao carregar dados</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
          </div>
          <button
            onClick={() => loadAll()}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Meus itens', value: items.length, color: 'text-green-600' },
          { label: 'Recebidas', value: received.filter((r) => r.status === 'pending').length, color: 'text-yellow-600' },
          { label: 'Em andamento', value: [...received, ...sent].filter((r) => r.status === 'in_progress').length, color: 'text-blue-600' },
          { label: 'Avaliações', value: reviews.length, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'received' && received.filter((r) => r.status === 'pending').length > 0 && (
                <span className="bg-yellow-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {received.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : (
        <>
          {/* My Items */}
          {tab === 'items' && (
            <div>
              {items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Nenhum item cadastrado"
                  description="Comece anunciando um item para seus vizinhos."
                  action={{ label: 'Anunciar item', onClick: () => router.push('/items/new') }}
                />
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">{item.title}</span>
                          <Badge variant="gray">{getCategoryLabel(item.category)}</Badge>
                          {item.availability_type === 'paid' && item.daily_rate && (
                            <Badge variant="blue">{formatCurrency(item.daily_rate)}/dia</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">
                            {item.is_available ? 'Disponível' : 'Indisponível'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={toggling === item.id}
                          onClick={() => toggleAvailability(item)}
                          title={item.is_available ? 'Desativar' : 'Ativar'}
                        >
                          {item.is_available ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Link href={`/items/${item.id}/edit`}>
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Received */}
          {tab === 'received' && (
            <div className="space-y-4">
              {received.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nenhuma solicitação recebida"
                  description="Quando alguém solicitar um dos seus itens, aparecerá aqui."
                />
              ) : (
                received.map((req) => (
                  <RequestCard key={req.id} request={req} role="owner" onUpdate={loadAll} />
                ))
              )}
            </div>
          )}

          {/* Sent */}
          {tab === 'sent' && (
            <div className="space-y-4">
              {sent.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="Nenhuma solicitação enviada"
                  description="Explore itens disponíveis e faça sua primeira solicitação."
                  action={{ label: 'Explorar itens', onClick: () => router.push('/items') }}
                />
              ) : (
                sent.map((req) => (
                  <RequestCard key={req.id} request={req} role="requester" onUpdate={loadAll} />
                ))
              )}
            </div>
          )}

          {/* History */}
          {tab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Nenhum histórico ainda"
                  description="Seu histórico de empréstimos e aluguéis aparecerá aqui."
                />
              ) : (
                history.map((req) => {
                  const isOwner = req.owner_id === user?.id
                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{req.item_title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isOwner ? `Solicitante: ${req.requester_name}` : `Dono: ${req.owner_name}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(req.pickup_date)} → {formatDate(req.expected_return_date)}
                          </p>
                        </div>
                        <Badge variant={STATUS_COLORS[req.status]}>
                          {REQUEST_STATUS_LABELS[req.status]}
                        </Badge>
                      </div>

                      {/* Review received for this request */}
                      {req.status === 'finished' && (() => {
                        const rev = reviews.find((r) => r.loan_request_id === req.id)
                        return rev ? (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-2">Avaliação recebida neste empréstimo:</p>
                            <ReviewCard review={rev} linkItem={false} />
                          </div>
                        ) : null
                      })()}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
