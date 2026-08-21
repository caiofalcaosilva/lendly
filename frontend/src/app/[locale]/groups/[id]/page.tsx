'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import NextImage from 'next/image'
import dynamic from 'next/dynamic'
import { Link, useRouter } from '@/i18n/navigation'
import { Users, Copy, Check, LogOut, Trash2, Package, X, ShieldCheck, Pencil, Crown, RefreshCw, Camera, Loader2, QrCode, Flag, UserCog, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

// QRCode only runs on client (canvas)
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })
import { Group, GroupMember, Item } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import ItemCard from '@/components/items/ItemCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Checkbox from '@/components/ui/Checkbox'
import Tooltip from '@/components/ui/Tooltip'
import Select from '@/components/ui/Select'
import GroupMural from '@/components/groups/GroupMural'
import GroupActivityFeed from '@/components/groups/GroupActivityFeed'
import ReportModal from '@/components/reports/ReportModal'
import { useToast } from '@/contexts/ToastContext'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false)
  const [itemsHasMore, setItemsHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewMembers, setPreviewMembers] = useState<GroupMember[]>([])
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersLoadingMore, setMembersLoadingMore] = useState(false)
  const [membersHasMore, setMembersHasMore] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  type PendingAction =
    | { kind: 'leave' }
    | { kind: 'delete' }
    | { kind: 'adminDelete' }
    | { kind: 'removeMember'; memberId: string; memberName: string }
    | { kind: 'removeMemberGroup'; memberId: string; memberName: string }
    | { kind: 'regenerateInvite' }
    | { kind: 'transferOwnership'; memberId: string; memberName: string }
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferCandidates, setTransferCandidates] = useState<GroupMember[]>([])
  const [locationRefreshing, setLocationRefreshing] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [expandedVouchers, setExpandedVouchers] = useState<Set<string>>(new Set())
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDiscoverable, setEditDiscoverable] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [vouchTarget, setVouchTarget] = useState<{ id: string; name: string } | null>(null)
  const [vouchNote, setVouchNote] = useState('')
  const [vouchSaving, setVouchSaving] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const t = useTranslations('Groups.Id')
  const toast = useToast()

  const MEMBERS_LIMIT = 30
  const PREVIEW_LIMIT = 8
  const ITEMS_LIMIT = 24

  const load = useCallback(() => {
    Promise.all([groupsService.get(id), groupsService.items(id, { limit: ITEMS_LIMIT })])
      .then(([g, i]) => {
        setGroup(g)
        setItems(i)
        setItemsHasMore(i.length === ITEMS_LIMIT)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { load() }, [load])

  const loadMoreItems = async () => {
    setItemsLoadingMore(true)
    try {
      const data = await groupsService.items(id, { skip: items.length, limit: ITEMS_LIMIT })
      setItems((prev) => [...prev, ...data])
      setItemsHasMore(data.length === ITEMS_LIMIT)
    } catch {
      toast.error(t('error'))
    } finally {
      setItemsLoadingMore(false)
    }
  }

  const loadPreview = useCallback(() => {
    groupsService.members(id, { limit: PREVIEW_LIMIT }).then(setPreviewMembers).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { loadPreview() }, [loadPreview])

  const loadMembers = useCallback((search: string) => {
    setMembersLoading(true)
    groupsService
      .members(id, { search: search.trim() || undefined, limit: MEMBERS_LIMIT })
      .then((data) => {
        setMembers(data)
        setMembersHasMore(data.length === MEMBERS_LIMIT)
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setMembersLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!membersModalOpen) return
    const timer = setTimeout(() => loadMembers(memberSearch), memberSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [memberSearch, loadMembers, membersModalOpen])

  const closeMembersModal = () => {
    setMembersModalOpen(false)
    setMemberSearch('')
    setExpandedVouchers(new Set())
    loadPreview()
  }

  const toggleVouchersExpanded = (memberId: string) => {
    setExpandedVouchers((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const loadMoreMembers = async () => {
    setMembersLoadingMore(true)
    try {
      const data = await groupsService.members(id, {
        search: memberSearch.trim() || undefined,
        skip: members.length,
        limit: MEMBERS_LIMIT,
      })
      setMembers((prev) => [...prev, ...data])
      setMembersHasMore(data.length === MEMBERS_LIMIT)
    } catch {
      toast.error(t('error'))
    } finally {
      setMembersLoadingMore(false)
    }
  }

  const patchMember = (updated: GroupMember) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  useEffect(() => {
    if (!transferOpen) return
    groupsService
      .members(id, { limit: 200 })
      .then((data) => setTransferCandidates(data.filter((m) => m.id !== group?.created_by)))
      .catch(() => toast.error(t('error')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferOpen, id])

  const isCreator = user && group && user.id === group.created_by
  const isMember = !!group?.is_viewer_member
  const isModerator = !!group?.is_viewer_moderator
  const canManageMembers = isMember && (isCreator || isModerator)

  const inviteUrl = typeof window !== 'undefined' && group
    ? `${window.location.origin}/groups/join/${group.invite_code}`
    : ''

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    setBusy(true)
    try {
      await groupsService.leave(id)
      router.push('/groups')
    } catch {
      toast.error(t('error'))
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await groupsService.remove(id)
      router.push('/groups')
    } catch {
      toast.error(t('error'))
      setBusy(false)
    }
  }

  const handleAdminDelete = async () => {
    setBusy(true)
    try {
      await groupsService.adminDelete(id)
      router.push('/admin/groups')
    } catch {
      toast.error(t('error'))
      setBusy(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setBusy(true)
    try {
      const updated = await groupsService.adminRemoveMember(id, memberId)
      setGroup(updated)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMemberGroup = async (memberId: string) => {
    setBusy(true)
    try {
      const updated = await groupsService.removeMember(id, memberId)
      setGroup(updated)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerateInvite = async () => {
    setBusy(true)
    try {
      const updated = await groupsService.regenerateInviteCode(id)
      setGroup(updated)
      setCopied(false)
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const handleRefreshLocation = async () => {
    setLocationRefreshing(true)
    try {
      const updated = await groupsService.refreshLocation(id)
      setGroup(updated)
      toast.success(t('refreshLocationSuccess'))
    } catch {
      toast.error(t('error'))
    } finally {
      setLocationRefreshing(false)
    }
  }

  const handleTransferOwnership = async (memberId: string) => {
    setBusy(true)
    try {
      const updated = await groupsService.transferOwnership(id, memberId)
      setGroup(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const confirmPendingAction = () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    if (action.kind === 'leave') handleLeave()
    else if (action.kind === 'delete') handleDelete()
    else if (action.kind === 'adminDelete') handleAdminDelete()
    else if (action.kind === 'removeMemberGroup') handleRemoveMemberGroup(action.memberId)
    else if (action.kind === 'regenerateInvite') handleRegenerateInvite()
    else if (action.kind === 'transferOwnership') handleTransferOwnership(action.memberId)
    else handleRemoveMember(action.memberId)
  }

  const handleToggleModerator = async (member: { id: string; is_moderator: boolean }) => {
    setBusy(true)
    try {
      const updated = member.is_moderator
        ? await groupsService.removeModerator(id, member.id)
        : await groupsService.addModerator(id, member.id)
      patchMember(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleVouch = async (member: { id: string; name: string; vouched_by_me: boolean }) => {
    if (member.vouched_by_me) {
      try {
        const updated = await groupsService.unvouch(id, member.id)
        patchMember(updated)
      } catch {
        toast.error(t('error'))
      }
    } else {
      setVouchTarget(member)
      setVouchNote('')
    }
  }

  const submitVouch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vouchTarget) return
    setVouchSaving(true)
    try {
      const updated = await groupsService.vouch(id, vouchTarget.id, vouchNote.trim() || undefined)
      patchMember(updated)
      setVouchTarget(null)
    } catch {
      toast.error(t('error'))
    } finally {
      setVouchSaving(false)
    }
  }

  const openEdit = () => {
    if (!group) return
    setEditName(group.name)
    setEditDescription(group.description || '')
    setEditDiscoverable(group.is_discoverable)
    setEditError('')
    setEditOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await groupsService.update(id, {
        name: editName,
        description: editDescription || undefined,
        is_discoverable: editDiscoverable,
      })
      setGroup(updated)
      setEditOpen(false)
    } catch (err: any) {
      setEditError(err.response?.data?.detail || t('editError'))
    } finally {
      setEditSaving(false)
    }
  }

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const updated = await groupsService.uploadPhoto(id, file)
      setGroup(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setPhotoBusy(false)
    }
  }

  const handlePhotoRemove = async () => {
    setPhotoBusy(true)
    try {
      const updated = await groupsService.removePhoto(id)
      setGroup(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setPhotoBusy(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner className="w-8 h-8 text-primary" />
    </div>
  )

  if (!group) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-ink-muted">
      {t('notFound')}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: t('breadcrumbGroups'), href: '/groups' },
          { label: group.name },
        ]}
      />

      <div className="bg-surface rounded-panel border border-border p-6 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {group.photo_url ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                  <NextImage src={group.photo_url} alt={group.name} fill unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-subtle flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              )}
              {canManageMembers && (
                <div className="absolute -bottom-1 -right-1">
                  <Tooltip label={t('changePhoto')}>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoBusy}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-on shadow-elevated hover:bg-primary-hover disabled:opacity-50"
                      aria-label={t('changePhoto')}
                    >
                      {photoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    </button>
                  </Tooltip>
                </div>
              )}
              {canManageMembers && group.photo_url && (
                <div className="absolute -top-1 -right-1">
                  <Tooltip label={t('removePhoto')}>
                    <button
                      type="button"
                      onClick={handlePhotoRemove}
                      disabled={photoBusy}
                      className="w-4 h-4 flex items-center justify-center rounded-full bg-ink text-bg hover:opacity-80 disabled:opacity-50"
                      aria-label={t('removePhoto')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Tooltip>
                </div>
              )}
              {canManageMembers && (
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoFile}
                  className="hidden"
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-extrabold tracking-tight text-ink">{group.name}</h1>
                {canManageMembers && (
                  <Tooltip label={t('editGroup')}>
                    <button
                      onClick={openEdit}
                      aria-label={t('editGroup')}
                      className="p-1 rounded-control text-ink-subtle hover:text-primary hover:bg-surface-2 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
              {group.description && <p className="text-sm text-ink-muted">{group.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isMember && !isCreator && (
              <Tooltip label={t('report')}>
                <button
                  onClick={() => setShowReport(true)}
                  aria-label={t('report')}
                  className="flex items-center gap-1 text-xs text-ink-subtle hover:text-danger transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}
            {isCreator && group.member_count > 1 && (
              <Tooltip label={t('transferOwnership')}>
                <button
                  onClick={() => { setTransferTargetId(''); setTransferOpen(true) }}
                  aria-label={t('transferOwnership')}
                  className="flex items-center gap-1 text-xs text-ink-subtle hover:text-primary transition-colors"
                >
                  <UserCog className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}
            {isMember && (
              <Button
                size="sm"
                variant={isCreator ? 'danger' : 'outline'}
                loading={busy}
                onClick={() => setPendingAction(isCreator ? { kind: 'delete' } : { kind: 'leave' })}
              >
                {isCreator ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                {isCreator ? t('deleteGroup') : t('leave')}
              </Button>
            )}
          </div>
          {!isMember && user?.is_admin && (
            <Button size="sm" variant="danger" loading={busy} onClick={() => setPendingAction({ kind: 'adminDelete' })}>
              <Trash2 className="w-4 h-4" /> {t('deleteGroup')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-control mb-4">
          <span className="text-xs text-ink-muted flex-1 truncate font-mono">{inviteUrl}</span>
          {canManageMembers && (
            <Tooltip label={t('regenerateInvite')}>
              <button
                onClick={() => setPendingAction({ kind: 'regenerateInvite' })}
                disabled={busy}
                aria-label={t('regenerateInvite')}
                className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-primary flex-shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={t('showQrCode')}>
            <button
              onClick={() => setQrOpen(true)}
              aria-label={t('showQrCode')}
              className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-primary flex-shrink-0"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t('copied') : t('copyInvite')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMembersModalOpen(true)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="flex -space-x-2">
            {previewMembers.map((m) => (
              <div
                key={m.id}
                className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-surface flex-shrink-0"
              >
                {m.avatar_url ? (
                  <NextImage src={m.avatar_url} alt={m.name} fill unoptimized className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary-subtle flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{m.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-xs font-medium text-primary">
            {t('memberCount', { count: group.member_count })} · {t('viewAllMembers')}
          </span>
        </button>
      </div>

      <h2 className="text-lg font-semibold text-ink mb-4">{t('groupItems')}</h2>
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('emptyItemsTitle')}
          description={t('emptyItemsDescription')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
          {itemsHasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" loading={itemsLoadingMore} onClick={loadMoreItems}>
                {t('loadMoreItems')}
              </Button>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-semibold text-ink mb-4 mt-10">{t('mural')}</h2>
      <GroupMural
        groupId={id}
        currentUserId={user?.id}
        canPost={isMember}
        canModerate={canManageMembers}
      />

      {isMember && (
        <>
          <h2 className="text-lg font-semibold text-ink mb-4 mt-10">{t('activityFeed')}</h2>
          <GroupActivityFeed groupId={id} />
        </>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('editGroup')}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <div className="p-3 bg-danger-subtle border border-danger/30 text-danger rounded-control text-sm">
              {editError}
            </div>
          )}
          <Input
            label={t('groupName')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Textarea
            label={t('description')}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />
          <div>
            <Checkbox checked={editDiscoverable} onChange={setEditDiscoverable} label={t('discoverableLabel')} />
            <p className="text-xs text-ink-subtle mt-1 ml-6">{t('discoverableHelp')}</p>
            <button
              type="button"
              onClick={handleRefreshLocation}
              disabled={locationRefreshing}
              className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-primary transition-colors mt-2 ml-6 disabled:opacity-50"
            >
              {locationRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {t('refreshLocation')}
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={editSaving} disabled={!editName.trim()} className="flex-1">
              {t('saveChanges')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title={t('showQrCode')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('qrCodeHelp')}</p>
          <div className="flex justify-center py-2">
            {inviteUrl && <QRCodeSVG value={inviteUrl} size={220} level="M" />}
          </div>
          <Button type="button" variant="outline" onClick={() => setQrOpen(false)} className="w-full">
            {t('cancel')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={membersModalOpen}
        onClose={closeMembersModal}
        title={t('membersModalTitle', { count: group.member_count })}
        maxWidth="max-w-2xl"
      >
        <div>
          {group.member_count > 8 && (
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t('searchMembers')}
              className="w-full mb-3 px-3 py-1.5 bg-surface text-ink border border-border rounded-control text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          {memberSearch && !membersLoading && members.length === 0 && (
            <p className="text-xs text-ink-subtle mb-2">{t('noMembersFound')}</p>
          )}
          <div className="divide-y divide-border max-h-[50vh] overflow-y-auto -mx-1">
            {members.map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between gap-3 px-1 py-2 hover:bg-surface-2 transition-colors">
                  <Link
                    href={`/users/${m.id}`}
                    className="flex items-center gap-2.5 min-w-0 group"
                  >
                    {m.avatar_url ? (
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <NextImage src={m.avatar_url} alt={m.name} fill unoptimized className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-subtle flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{m.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="text-sm text-ink truncate group-hover:text-primary transition-colors">
                      {m.name}
                    </span>
                    {!isCreator && m.is_moderator && (
                      <Tooltip label={t('moderatorBadge')} className="flex-shrink-0 text-accent">
                        <Crown className="w-3.5 h-3.5 fill-accent-subtle" />
                      </Tooltip>
                    )}
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isMember && user && m.id !== user.id && (
                      <Tooltip label={m.vouched_by_me ? t('vouchedTooltip') : t('vouchTooltip')}>
                        <button
                          onClick={() => handleToggleVouch(m)}
                          aria-label={m.vouched_by_me ? t('vouchedTooltip') : t('vouchTooltip')}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-control text-xs font-medium transition-colors ${
                            m.vouched_by_me
                              ? 'bg-primary-subtle text-primary'
                              : 'text-ink-subtle hover:text-primary hover:bg-surface-2'
                          }`}
                        >
                          <ShieldCheck className={`w-4 h-4 ${m.vouched_by_me ? 'fill-primary-subtle' : ''}`} />
                          {m.vouch_count > 0 && <span className="font-mono tabular-nums">{m.vouch_count}</span>}
                        </button>
                      </Tooltip>
                    )}
                    {m.vouchers.length > 0 && (
                      <Tooltip label={t('showVouchers')}>
                        <button
                          onClick={() => toggleVouchersExpanded(m.id)}
                          aria-label={t('showVouchers')}
                          aria-expanded={expandedVouchers.has(m.id)}
                          className="p-1.5 rounded-control text-ink-subtle hover:text-primary hover:bg-surface-2 transition-colors"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${expandedVouchers.has(m.id) ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </Tooltip>
                    )}
                    {isCreator && m.id !== group.created_by && (
                      <Tooltip label={m.is_moderator ? t('revokeModerator') : t('makeModerator')}>
                        <button
                          onClick={() => handleToggleModerator(m)}
                          disabled={busy}
                          aria-label={m.is_moderator ? t('revokeModerator') : t('makeModerator')}
                          className={`p-1.5 rounded-control transition-colors ${
                            m.is_moderator
                              ? 'bg-accent-subtle text-accent'
                              : 'text-ink-subtle hover:text-accent hover:bg-surface-2'
                          }`}
                        >
                          <Crown className={`w-4 h-4 ${m.is_moderator ? 'fill-accent-subtle' : ''}`} />
                        </button>
                      </Tooltip>
                    )}
                    {canManageMembers &&
                      m.id !== group.created_by &&
                      !(m.is_moderator && !isCreator) && (
                        <Tooltip label={t('removeFromGroup')}>
                          <button
                            onClick={() =>
                              setPendingAction({ kind: 'removeMemberGroup', memberId: m.id, memberName: m.name })
                            }
                            disabled={busy}
                            aria-label={t('removeFromGroup')}
                            className="p-1.5 rounded-control text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                    {!isMember && user?.is_admin && m.id !== group.created_by && (
                      <Tooltip label={t('removeFromGroup')}>
                        <button
                          onClick={() => setPendingAction({ kind: 'removeMember', memberId: m.id, memberName: m.name })}
                          disabled={busy}
                          aria-label={t('removeFromGroup')}
                          className="p-1.5 rounded-control text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
                {expandedVouchers.has(m.id) && (
                  <div className="pl-11 pr-2 pb-2 -mt-1 space-y-1">
                    {m.vouchers.map((v) => (
                      <p key={v.id} className="text-xs text-ink-muted">
                        <span className="font-medium text-ink">{v.name}</span>
                        {v.note && <span> — {v.note}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {membersHasMore && (
            <div className="flex justify-center mt-3">
              <Button variant="outline" size="sm" loading={membersLoadingMore} onClick={loadMoreMembers}>
                {t('loadMoreMembers')}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={vouchTarget !== null}
        onClose={() => setVouchTarget(null)}
        title={vouchTarget ? t('vouchModalTitle', { name: vouchTarget.name }) : ''}
      >
        <form onSubmit={submitVouch} className="space-y-4">
          <Input
            label={t('vouchNoteLabel')}
            value={vouchNote}
            onChange={(e) => setVouchNote(e.target.value)}
            placeholder={t('vouchNotePlaceholder')}
            maxLength={200}
          />
          <div className="flex gap-3">
            <Button type="submit" loading={vouchSaving} className="flex-1">
              {t('vouchConfirm')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setVouchTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {showReport && (
        <ReportModal
          reportedGroupId={id}
          targetLabel={t('reportTargetLabel')}
          onClose={() => setShowReport(false)}
          onSuccess={() => { setShowReport(false); toast.success(t('reportSent')) }}
        />
      )}

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={t('transferOwnership')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('transferOwnershipHelp')}</p>
          <Select
            label={t('transferOwnershipLabel')}
            value={transferTargetId}
            onChange={(e) => setTransferTargetId(e.target.value)}
          >
            <option value="">{t('transferOwnershipSelect')}</option>
            {transferCandidates.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <div className="flex gap-3">
            <Button
              type="button"
              disabled={!transferTargetId}
              className="flex-1"
              onClick={() => {
                const target = transferCandidates.find((m) => m.id === transferTargetId)
                if (!target) return
                setTransferOpen(false)
                setPendingAction({ kind: 'transferOwnership', memberId: target.id, memberName: target.name })
              }}
            >
              {t('transferOwnershipContinue')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={
          pendingAction?.kind === 'leave' ? t('leave')
            : pendingAction?.kind === 'removeMember' || pendingAction?.kind === 'removeMemberGroup' ? t('removeFromGroup')
            : pendingAction?.kind === 'regenerateInvite' ? t('regenerateInvite')
            : pendingAction?.kind === 'transferOwnership' ? t('transferOwnership')
            : t('deleteGroup')
        }
        description={
          pendingAction?.kind === 'leave' ? t('confirmLeave')
            : pendingAction?.kind === 'delete' ? t('confirmDelete')
            : pendingAction?.kind === 'adminDelete' ? t('confirmAdminDelete')
            : pendingAction?.kind === 'removeMember' ? t('confirmRemoveMember', { name: pendingAction.memberName })
            : pendingAction?.kind === 'removeMemberGroup' ? t('confirmRemoveMember', { name: pendingAction.memberName })
            : pendingAction?.kind === 'regenerateInvite' ? t('confirmRegenerateInvite')
            : pendingAction?.kind === 'transferOwnership' ? t('confirmTransferOwnership', { name: pendingAction.memberName })
            : ''
        }
        loading={busy}
      />
    </div>
  )
}
