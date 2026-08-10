'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { Users, Copy, Check, LogOut, Trash2, Package, X, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Group, Item } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ItemCard from '@/components/items/ItemCard'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useTranslations('Groups.Id')

  const load = useCallback(() => {
    Promise.all([groupsService.get(id), groupsService.items(id)])
      .then(([g, i]) => { setGroup(g); setItems(i) })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const isCreator = user && group && user.id === group.created_by
  const isMember = !!(user && group && group.members.some((m) => m.id === user.id))

  const inviteUrl = typeof window !== 'undefined' && group
    ? `${window.location.origin}/groups/join/${group.invite_code}`
    : ''

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    if (!confirm(t('confirmLeave'))) return
    setBusy(true)
    try {
      await groupsService.leave(id)
      router.push('/groups')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return
    setBusy(true)
    try {
      await groupsService.remove(id)
      router.push('/groups')
    } finally {
      setBusy(false)
    }
  }

  const handleAdminDelete = async () => {
    if (!confirm(t('confirmAdminDelete'))) return
    setBusy(true)
    try {
      await groupsService.adminDelete(id)
      router.push('/admin/groups')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(t('confirmRemoveMember', { name: memberName }))) return
    setBusy(true)
    try {
      const updated = await groupsService.adminRemoveMember(id, memberId)
      setGroup(updated)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleVouch = async (member: { id: string; vouched_by_me: boolean }) => {
    const updated = member.vouched_by_me
      ? await groupsService.unvouch(id, member.id)
      : await groupsService.vouch(id, member.id)
    setGroup(updated)
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner className="w-8 h-8 text-green-600" />
    </div>
  )

  if (!group) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500 dark:text-gray-400">
      {t('notFound')}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{group.name}</h1>
              {group.description && <p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>}
            </div>
          </div>
          {isMember && (
            <Button
              size="sm"
              variant={isCreator ? 'danger' : 'outline'}
              loading={busy}
              onClick={isCreator ? handleDelete : handleLeave}
            >
              {isCreator ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              {isCreator ? t('deleteGroup') : t('leave')}
            </Button>
          )}
          {!isMember && user?.is_admin && (
            <Button size="sm" variant="danger" loading={busy} onClick={handleAdminDelete}>
              <Trash2 className="w-4 h-4" /> {t('deleteGroup')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate font-mono">{inviteUrl}</span>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t('copied') : t('copyInvite')}
          </button>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('memberCount', { count: group.member_count })}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full pl-2.5 pr-1 py-1"
              >
                <Link
                  href={`/users/${m.id}`}
                  className="text-xs text-gray-700 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 transition-colors"
                >
                  {m.name}
                </Link>
                {user && m.id !== user.id && (
                  <button
                    onClick={() => handleToggleVouch(m)}
                    title={m.vouched_by_me ? t('vouchedTooltip') : t('vouchTooltip')}
                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] transition-colors ${
                      m.vouched_by_me
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400'
                    }`}
                  >
                    <ShieldCheck className={`w-3 h-3 ${m.vouched_by_me ? 'fill-green-100 dark:fill-green-900' : ''}`} />
                    {m.vouch_count > 0 && m.vouch_count}
                  </button>
                )}
                {user?.is_admin && m.id !== group.created_by && (
                  <button
                    onClick={() => handleRemoveMember(m.id, m.name)}
                    disabled={busy}
                    title={t('removeFromGroup')}
                    className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('groupItems')}</h2>
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('emptyItemsTitle')}
          description={t('emptyItemsDescription')}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
