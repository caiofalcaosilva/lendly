'use client'
import { useEffect, useState, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import {
  Package, Inbox, Send, History, Plus, Edit, Eye, EyeOff, Star, AlertCircle, RefreshCw, Heart, BarChart3, TrendingUp, Percent, Trophy,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ReviewCard from '@/components/reviews/ReviewCard'
import ItemCard from '@/components/items/ItemCard'
import { Category, FavoriteUserSummary, Item, LoanRequest, OwnerAnalyticsSummary, RequesterSpendingSummary, Review } from '@/types'
import { itemsService } from '@/services/items'
import { requestsService } from '@/services/requests'
import { reviewsService } from '@/services/reviews'
import { usersService } from '@/services/users'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import { getCategoryLabel, formatCurrency, formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge, { STATUS_COLORS } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import RequestCard from '@/components/requests/RequestCard'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import Avatar from '@/components/ui/Avatar'
import BusinessBadge from '@/components/ui/BusinessBadge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Tab = 'items' | 'received' | 'sent' | 'history' | 'favorites' | 'given-reviews' | 'analytics'

const TAB_ICONS: Record<Tab, React.ElementType> = {
  items: Package,
  received: Inbox,
  sent: Send,
  history: History,
  favorites: Heart,
  'given-reviews': Star,
  analytics: BarChart3,
}
const TAB_IDS: Tab[] = ['items', 'received', 'sent', 'history', 'favorites', 'given-reviews', 'analytics']

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, updateUser } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('items')
  const [items, setItems] = useState<Item[]>([])
  const [received, setReceived] = useState<LoanRequest[]>([])
  const [sent, setSent] = useState<LoanRequest[]>([])
  const [history, setHistory] = useState<LoanRequest[]>([])
  const [favorites, setFavorites] = useState<Item[]>([])
  const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUserSummary[]>([])
  const [spending, setSpending] = useState<RequesterSpendingSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [givenReviews, setGivenReviews] = useState<Review[]>([])
  const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [featuring, setFeaturing] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Dashboard')
  const tStatus = useTranslations('Common.RequestStatus')

  useEffect(() => {
    categoriesService.list().then(setCategories)
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setLoadError(null)
    try {
      const [myItems, recv, snt, hist, favs, favUsers, stats, spend] = await Promise.all([
        itemsService.myItems(),
        requestsService.received(),
        requestsService.sent(),
        requestsService.history(),
        itemsService.myFavorites(),
        usersService.getFavoriteUsers(),
        usersService.getMyAnalytics(),
        usersService.getMySpending(),
      ])
      setItems(myItems)
      setReceived(recv)
      setSent(snt)
      setHistory(hist)
      setFavorites(favs)
      setFavoriteUsers(favUsers)
      setAnalytics(stats)
      setSpending(spend)
      if (user) {
        reviewsService.forUser(user.id).then(setReviews).catch(() => {})
        reviewsService.mine().then(setGivenReviews).catch(() => {})
      }
    } catch (e: any) {
      if (!e.response) {
        setLoadError(t('cannotConnect', { url: API_URL }))
      } else {
        setLoadError(e.response?.data?.detail || t('errorLoadingStatus', { status: e.response?.status }))
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

  const MAX_FEATURED = 3

  const toggleFeatured = async (item: Item) => {
    if (!user) return
    const current = user.featured_item_ids ?? []
    const isFeatured = current.includes(item.id)
    if (!isFeatured && current.length >= MAX_FEATURED) return

    const next = isFeatured ? current.filter((id) => id !== item.id) : [...current, item.id]
    setFeaturing(item.id)
    try {
      const updated = await usersService.setFeaturedItems(next)
      updateUser(updated)
    } finally {
      setFeaturing(null)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('greeting', { name: user?.name.split(' ')[0] ?? '' })}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('ratingCount', { rating: user?.average_rating.toFixed(1) ?? '0.0', count: user?.rating_count ?? 0 })}
            </span>
            <ReliabilityBadge score={user?.reliability_score} count={user?.reliability_count ?? 0} />
          </div>
        </div>
        {!user?.is_admin && (
          <Link href="/items/new">
            <Button>
              <Plus className="w-4 h-4" /> {t('listItem')}
            </Button>
          </Link>
        )}
      </div>

      {!loading && !user?.is_admin && (
        <OnboardingChecklist
          hasAddress={!!user?.zip_code}
          hasItems={items.length > 0}
          hasSentRequest={sent.length > 0}
        />
      )}

      {/* Error banner */}
      {loadError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{t('errorLoading')}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{loadError}</p>
          </div>
          <button
            onClick={() => loadAll()}
            className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('retry')}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { key: 'myItems', value: items.length, color: 'text-green-600 dark:text-green-400' },
          { key: 'received', value: received.filter((r) => r.status === 'pending').length, color: 'text-yellow-600 dark:text-yellow-400' },
          { key: 'inProgress', value: [...received, ...sent].filter((r) => r.status === 'in_progress').length, color: 'text-blue-600 dark:text-blue-400' },
          { key: 'reviews', value: reviews.length, color: 'text-purple-600 dark:text-purple-400' },
        ].map(({ key, value, color }) => (
          <div key={key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(`stats.${key}`)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TAB_IDS.map((id) => {
            const Icon = TAB_ICONS[id]
            return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(`tabs.${id}`)}
              {id === 'received' && received.filter((r) => r.status === 'pending').length > 0 && (
                <span className="bg-yellow-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {received.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>
            )
          })}
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
                  title={t('items.emptyTitle')}
                  description={user?.is_admin ? t('adminNoItems') : t('items.emptyDescription')}
                  action={user?.is_admin ? undefined : { label: t('listItem'), onClick: () => router.push('/items/new') }}
                />
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</span>
                          <Badge variant="gray">{getCategoryLabel(categories, item.category)}</Badge>
                          {item.availability_type === 'paid' && item.daily_rate && (
                            <Badge variant="blue">{formatCurrency(item.daily_rate, locale)}{t('perDay')}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {item.is_available ? t('available') : t('unavailable')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={featuring === item.id}
                          disabled={!(user?.featured_item_ids ?? []).includes(item.id) && (user?.featured_item_ids?.length ?? 0) >= MAX_FEATURED}
                          onClick={() => toggleFeatured(item)}
                          title={(user?.featured_item_ids ?? []).includes(item.id) ? t('removeFromFeatured') : t('featureOnProfile', { max: MAX_FEATURED })}
                        >
                          <Star className={`w-4 h-4 ${(user?.featured_item_ids ?? []).includes(item.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={toggling === item.id}
                          onClick={() => toggleAvailability(item)}
                          title={item.is_available ? t('deactivate') : t('activate')}
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
                  title={t('received.emptyTitle')}
                  description={t('received.emptyDescription')}
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
              {spending && spending.total_spent > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('sent.totalSpent')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(spending.total_spent, locale)}</p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('sent.paymentsCount', { count: spending.payments_count })}
                  </p>
                </div>
              )}
              {sent.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title={t('sent.emptyTitle')}
                  description={t('sent.emptyDescription')}
                  action={{ label: t('exploreItems'), onClick: () => router.push('/items') }}
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
                  title={t('history.emptyTitle')}
                  description={t('history.emptyDescription')}
                />
              ) : (
                history.map((req) => {
                  const isOwner = req.owner_id === user?.id
                  return (
                    <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{req.item_title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {isOwner ? t('requester', { name: req.requester_name }) : t('owner', { name: req.owner_name })}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatDate(req.pickup_date, locale)} → {formatDate(req.expected_return_date, locale)}
                          </p>
                        </div>
                        <Badge variant={STATUS_COLORS[req.status]}>
                          {tStatus(req.status)}
                        </Badge>
                      </div>

                      {/* Review received for this request */}
                      {req.status === 'finished' && (() => {
                        const rev = reviews.find((r) => r.loan_request_id === req.id)
                        return rev ? (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('history.reviewReceived')}</p>
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

          {/* Favorites */}
          {tab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <EmptyState
                  icon={Heart}
                  title={t('favorites.emptyTitle')}
                  description={t('favorites.emptyDescription')}
                  action={{ label: t('exploreItems'), onClick: () => router.push('/items') }}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {favorites.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onFavoriteChange={(changed, favorited) => {
                        if (!favorited) {
                          setFavorites((prev) => prev.filter((f) => f.id !== changed.id))
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {favoriteUsers.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    {t('favorites.favoritePeople')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {favoriteUsers.map((u) => (
                      <Link
                        key={u.id}
                        href={`/users/${u.id}`}
                        className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-green-300 dark:hover:border-green-700 transition-colors"
                      >
                        <Avatar name={u.trade_name || u.name} avatarUrl={u.avatar_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                              {u.trade_name || u.name}
                            </span>
                            <BusinessBadge accountType={u.account_type} />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {u.average_rating.toFixed(1)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Given reviews */}
          {tab === 'given-reviews' && (
            <div>
              {givenReviews.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title={t('givenReviews.emptyTitle')}
                  description={t('givenReviews.emptyDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {givenReviews.map((rev) => (
                    <ReviewCard key={rev.id} review={rev} perspective="given" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics */}
          {tab === 'analytics' && (
            <div>
              {!analytics || analytics.total_items === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title={t('analytics.emptyTitle')}
                  description={user?.is_admin ? t('adminNoItems') : t('analytics.emptyDescription')}
                  action={user?.is_admin ? undefined : { label: t('listItem'), onClick: () => router.push('/items/new') }}
                />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs">{t('analytics.totalRevenue')}</span>
                      </div>
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(analytics.total_revenue, locale)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
                        <History className="w-3.5 h-3.5" />
                        <span className="text-xs">{t('analytics.finishedLoans')}</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {analytics.total_loans}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
                        <Percent className="w-3.5 h-3.5" />
                        <span className="text-xs">{t('analytics.averageOccupancy')}</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {analytics.average_occupancy_rate}%
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1">
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="text-xs">{t('analytics.mostPopularItem')}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={analytics.most_popular_item ?? undefined}>
                        {analytics.most_popular_item ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3 font-medium">{t('analytics.tableItem')}</th>
                          <th className="px-4 py-3 font-medium text-right">{t('analytics.tableLoans')}</th>
                          <th className="px-4 py-3 font-medium text-right">{t('analytics.tableRevenue')}</th>
                          <th className="px-4 py-3 font-medium text-right">{t('analytics.tableOccupancy')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.items.map((it) => (
                          <tr key={it.item_id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                            <td className="px-4 py-3">
                              <Link href={`/items/${it.item_id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                                {it.title}
                              </Link>
                              <div className="text-xs text-gray-400 dark:text-gray-500">{getCategoryLabel(categories, it.category)}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{it.times_borrowed}</td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                              {it.revenue > 0 ? formatCurrency(it.revenue, locale) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2 justify-end w-full">
                                <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${it.occupancy_rate}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right">{it.occupancy_rate}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
