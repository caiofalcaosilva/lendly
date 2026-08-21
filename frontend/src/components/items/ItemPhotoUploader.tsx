'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Plus, X, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { itemsService } from '@/services/items'
import Tooltip from '@/components/ui/Tooltip'

const MAX_PHOTOS = 8

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export default function ItemPhotoUploader({
  itemId,
  photos,
  onChange,
}: {
  itemId: string
  photos: string[]
  onChange: (photos: string[]) => void
}) {
  const t = useTranslations('Common.ItemPhotoField')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const updated = await itemsService.uploadPhoto(itemId, file)
      onChange(updated.photos)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  // Removal is deferred: it only takes effect when the surrounding form is
  // saved (PUT with the reduced `photos` list) — there's no per-photo
  // delete endpoint. Upload, on the other hand, happens immediately.
  // Reordering (including cover selection, which is just "move to index 0")
  // is also deferred the same way — the backend has no reorder endpoint
  // either, only a full-array PUT.
  const remove = (url: string) => onChange(photos.filter((p) => p !== url))
  const makeCover = (index: number) => onChange(reorder(photos, index, 0))
  const drop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) onChange(reorder(photos, dragIndex, index))
    setDragIndex(null)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-2">{t('label')}</label>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            className="group relative w-[90px] h-[90px] rounded-control overflow-hidden border border-border bg-surface-2 cursor-grab active:cursor-grabbing"
          >
            <Image src={url} alt={t('photoAlt', { number: i + 1 })} fill unoptimized className="object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-primary-on">
                {t('cover')}
              </span>
            ) : (
              <div className="absolute bottom-1 left-1 hidden group-hover:block">
                <Tooltip label={t('makeCover')}>
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label={t('makeCover')}
                  >
                    <Star className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            )}
            <div className="absolute top-1 right-1">
              <Tooltip label={t('removePhoto')}>
                <button
                  type="button"
                  onClick={() => remove(url)}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={t('removePhoto')}
                >
                  <X className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-[90px] h-[90px] flex items-center justify-center border border-dashed border-border rounded-control text-ink-subtle hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            aria-label={t('addPhoto')}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
