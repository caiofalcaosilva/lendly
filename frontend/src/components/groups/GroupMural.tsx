'use client'
import { useCallback, useEffect, useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { GroupPost } from '@/types'
import { groupPostsService } from '@/services/groupPosts'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'

const LIMIT = 20

function SkeletonPost() {
  return (
    <div className="p-3 bg-surface-2 rounded-control space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

export default function GroupMural({
  groupId,
  currentUserId,
  canPost,
  canModerate,
}: {
  groupId: string
  currentUserId?: string
  canPost: boolean
  canModerate: boolean
}) {
  const [posts, setPosts] = useState<GroupPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GroupPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  const locale = useLocale() as 'pt' | 'en'
  const t = useTranslations('Groups.Mural')
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    groupPostsService
      .list(groupId, undefined, LIMIT)
      .then((data) => {
        setPosts(data)
        setHasMore(data.length === LIMIT)
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const lastId = posts[posts.length - 1]?.id
      const data = await groupPostsService.list(groupId, lastId, LIMIT)
      setPosts((prev) => [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } catch {
      toast.error(t('error'))
    } finally {
      setLoadingMore(false)
    }
  }

  const handlePost = async () => {
    if (!body.trim()) return
    setPosting(true)
    try {
      const post = await groupPostsService.create(groupId, body.trim())
      setPosts((prev) => [post, ...prev])
      setBody('')
    } catch {
      toast.error(t('postError'))
    } finally {
      setPosting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await groupPostsService.remove(groupId, deleteTarget.id)
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error(t('deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {canPost && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('placeholder')}
              rows={3}
              maxLength={1000}
              className="resize-none"
            />
          </div>
          <Button onClick={handlePost} loading={posting} disabled={!body.trim()} className="flex-shrink-0">
            {t('post')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonPost key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="space-y-2.5">
            {posts.map((post) => {
              const canDelete = canModerate || post.author.id === currentUserId
              return (
                <div key={post.id} className="p-3 bg-surface-2 rounded-control">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-muted">
                        {post.author.name}
                        <span className="text-ink-subtle font-normal"> · {formatDate(post.created_at, locale)}</span>
                      </p>
                      <p className="text-sm text-ink mt-1 whitespace-pre-wrap break-words">{post.body}</p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteTarget(post)}
                        title={t('deletePost')}
                        aria-label={t('deletePost')}
                        className="p-1 rounded-control text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('deletePost')}
        description={t('confirmDelete')}
        loading={deleting}
      />
    </div>
  )
}
