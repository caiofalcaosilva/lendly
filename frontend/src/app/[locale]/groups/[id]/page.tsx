'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import NextImage from 'next/image'
import dynamic from 'next/dynamic'
import { Link, useRouter } from '@/i18n/navigation'
import { Users, Copy, Check, LogOut, Trash2, Package, X, ShieldCheck, Pencil, Crown, RefreshCw, Camera, Loader2, QrCode, Flag } from 'lucide-react'
import { useTranslations } from 'next-intl'

// QRCode only runs on client (canvas)
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })
import { Group, Item } from '@/types'
import { groupsService } from '@/services/groups'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ItemCard from '@/components/items/ItemCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
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
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  type PendingAction =
    | { kind: 'leave' }
    | { kind: 'delete' }
    | { kind: 'adminDelete' }
    | { kind: 'removeMember'; memberId: string; memberName: string }
    | { kind: 'removeMemberGroup'; memberId: string; memberName: string }
    | { kind: 'regenerateInvite' }
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
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

  const load = useCallback(() => {
    Promise.all([groupsService.get(id), groupsService.items(id)])
      .then(([g, i]) => { setGroup(g); setItems(i) })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const isCreator = user && group && user.id === group.created_by
  const isMember = !!(user && group && group.members.some((m) => m.id === user.id))
  const isModerator = !!(
    user && group && group.members.some((m) => m.id === user.id && m.is_moderator)
  )
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

  const confirmPendingAction = () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    if (action.kind === 'leave') handleLeave()
    else if (action.kind === 'delete') handleDelete()
    else if (action.kind === 'adminDelete') handleAdminDelete()
    else if (action.kind === 'removeMemberGroup') handleRemoveMemberGroup(action.memberId)
    else if (action.kind === 'regenerateInvite') handleRegenerateInvite()
    else handleRemoveMember(action.memberId)
  }

  const handleToggleModerator = async (member: { id: string; is_moderator: boolean }) => {
    setBusy(true)
    try {
      const updated = member.is_moderator
        ? await groupsService.removeModerator(id, member.id)
        : await groupsService.addModerator(id, member.id)
      setGroup(updated)
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleVouch = async (member: { id: string; name: string; vouched_by_me: boolean }) => {
    if (member.vouched_by_me) {
      const updated = await groupsService.unvouch(id, member.id)
      setGroup(updated)
    } else {
      setVouchTarget(member)
      setVouchNote('')
    }
  }

  const submitVouch = async () => {
    if (!vouchTarget) return
    setVouchSaving(true)
    try {
      const updated = await groupsService.vouch(id, vouchTarget.id, vouchNote.trim() || undefined)
      setGroup(updated)
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
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoBusy}
                  className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-on shadow-elevated hover:bg-primary-hover disabled:opacity-50"
                  title={t('changePhoto')}
                  aria-label={t('changePhoto')}
                >
                  {photoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                </button>
              )}
              {canManageMembers && group.photo_url && (
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  disabled={photoBusy}
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-ink text-bg hover:opacity-80 disabled:opacity-50"
                  title={t('removePhoto')}
                  aria-label={t('removePhoto')}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
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
                  <button
                    onClick={openEdit}
                    aria-label={t('editGroup')}
                    title={t('editGroup')}
                    className="p-1 rounded-control text-ink-subtle hover:text-primary hover:bg-surface-2 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {group.description && <p className="text-sm text-ink-muted">{group.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isMember && !isCreator && (
              <button
                onClick={() => setShowReport(true)}
                title={t('report')}
                aria-label={t('report')}
                className="flex items-center gap-1 text-xs text-ink-subtle hover:text-danger transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
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
            <button
              onClick={() => setPendingAction({ kind: 'regenerateInvite' })}
              disabled={busy}
              title={t('regenerateInvite')}
              aria-label={t('regenerateInvite')}
              className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-primary flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setQrOpen(true)}
            title={t('showQrCode')}
            aria-label={t('showQrCode')}
            className="flex items-center gap-1 text-xs font-medium text-ink-subtle hover:text-primary flex-shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t('copied') : t('copyInvite')}
          </button>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-muted mb-2">
            {t('memberCount', { count: group.member_count })}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1 bg-surface-2 rounded-full pl-2.5 pr-1 py-1"
              >
                <Link
                  href={`/users/${m.id}`}
                  className="text-xs text-ink-muted hover:text-primary transition-colors"
                >
                  {m.name}
                </Link>
                {user && m.id !== user.id && (
                  <button
                    onClick={() => handleToggleVouch(m)}
                    title={
                      m.vouch_notes.length > 0
                        ? t('vouchNotesTooltip', { notes: m.vouch_notes.join(', ') })
                        : m.vouched_by_me ? t('vouchedTooltip') : t('vouchTooltip')
                    }
                    aria-label={m.vouched_by_me ? t('vouchedTooltip') : t('vouchTooltip')}
                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] transition-colors ${
                      m.vouched_by_me
                        ? 'text-primary'
                        : 'text-ink-subtle hover:text-primary'
                    }`}
                  >
                    <ShieldCheck className={`w-3 h-3 ${m.vouched_by_me ? 'fill-primary-subtle' : ''}`} />
                    {m.vouch_count > 0 && m.vouch_count}
                  </button>
                )}
                {isCreator && m.id !== group.created_by && (
                  <button
                    onClick={() => handleToggleModerator(m)}
                    disabled={busy}
                    title={m.is_moderator ? t('revokeModerator') : t('makeModerator')}
                    aria-label={m.is_moderator ? t('revokeModerator') : t('makeModerator')}
                    className={`flex items-center px-1 py-0.5 rounded-full transition-colors ${
                      m.is_moderator ? 'text-accent' : 'text-ink-subtle hover:text-accent'
                    }`}
                  >
                    <Crown className={`w-3 h-3 ${m.is_moderator ? 'fill-accent-subtle' : ''}`} />
                  </button>
                )}
                {!isCreator && m.is_moderator && (
                  <span title={t('moderatorBadge')} className="flex items-center px-1 text-accent">
                    <Crown className="w-3 h-3 fill-accent-subtle" />
                  </span>
                )}
                {canManageMembers &&
                  m.id !== group.created_by &&
                  !(m.is_moderator && !isCreator) && (
                    <button
                      onClick={() =>
                        setPendingAction({ kind: 'removeMemberGroup', memberId: m.id, memberName: m.name })
                      }
                      disabled={busy}
                      title={t('removeFromGroup')}
                      aria-label={t('removeFromGroup')}
                      className="p-0.5 rounded-full text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                {!isMember && user?.is_admin && m.id !== group.created_by && (
                  <button
                    onClick={() => setPendingAction({ kind: 'removeMember', memberId: m.id, memberName: m.name })}
                    disabled={busy}
                    title={t('removeFromGroup')}
                    aria-label={t('removeFromGroup')}
                    className="p-0.5 rounded-full text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink mb-4">{t('groupItems')}</h2>
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

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={
          pendingAction?.kind === 'leave' ? t('leave')
            : pendingAction?.kind === 'removeMember' || pendingAction?.kind === 'removeMemberGroup' ? t('removeFromGroup')
            : pendingAction?.kind === 'regenerateInvite' ? t('regenerateInvite')
            : t('deleteGroup')
        }
        description={
          pendingAction?.kind === 'leave' ? t('confirmLeave')
            : pendingAction?.kind === 'delete' ? t('confirmDelete')
            : pendingAction?.kind === 'adminDelete' ? t('confirmAdminDelete')
            : pendingAction?.kind === 'removeMember' ? t('confirmRemoveMember', { name: pendingAction.memberName })
            : pendingAction?.kind === 'removeMemberGroup' ? t('confirmRemoveMember', { name: pendingAction.memberName })
            : pendingAction?.kind === 'regenerateInvite' ? t('confirmRegenerateInvite')
            : ''
        }
        loading={busy}
      />

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
            <label className="flex items-center gap-2 cursor-pointer text-ink">
              <input
                type="checkbox"
                checked={editDiscoverable}
                onChange={(e) => setEditDiscoverable(e.target.checked)}
                className="text-primary rounded"
              />
              <span className="text-sm">{t('discoverableLabel')}</span>
            </label>
            <p className="text-xs text-ink-subtle mt-1 ml-6">{t('discoverableHelp')}</p>
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
        open={vouchTarget !== null}
        onClose={() => setVouchTarget(null)}
        title={vouchTarget ? t('vouchModalTitle', { name: vouchTarget.name }) : ''}
      >
        <div className="space-y-4">
          <Input
            label={t('vouchNoteLabel')}
            value={vouchNote}
            onChange={(e) => setVouchNote(e.target.value)}
            placeholder={t('vouchNotePlaceholder')}
            maxLength={200}
          />
          <div className="flex gap-3">
            <Button onClick={submitVouch} loading={vouchSaving} className="flex-1">
              {t('vouchConfirm')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setVouchTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {showReport && (
        <ReportModal
          reportedGroupId={id}
          targetLabel={t('reportTargetLabel')}
          onClose={() => setShowReport(false)}
          onSuccess={() => { setShowReport(false); toast.success(t('reportSent')) }}
        />
      )}
    </div>
  )
}
