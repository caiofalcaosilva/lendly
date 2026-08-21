'use client'
import { useEffect, useRef, useState } from 'react'
import { Plus, X, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Tooltip from '@/components/ui/Tooltip'

const MAX_PHOTOS = 8

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/// Local-only photo staging for the item *creation* form: the upload
/// endpoint (`POST /items/{id}/photos`) requires a real item id, which
/// doesn't exist yet at this point, so files are just held in memory (with
/// an object-URL preview) and handed to the caller, which uploads them
/// right after the item itself is created — same click, no extra step for
/// the user. See `ItemPhotoUploader` for the edit-mode equivalent, which
/// uploads immediately since a real item id is already available there.
export default function ItemPhotoPicker({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const t = useTranslations('Common.ItemPhotoField')
  const inputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    onChange([...files, picked])
  }

  const remove = (index: number) => onChange(files.filter((_, i) => i !== index))
  const makeCover = (index: number) => onChange(reorder(files, index, 0))
  const drop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) onChange(reorder(files, dragIndex, index))
    setDragIndex(null)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-2">{t('label')}</label>
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div
            key={src}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            className="group relative w-[90px] h-[90px] rounded-control overflow-hidden border border-border bg-surface-2 cursor-grab active:cursor-grabbing"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize these */}
            <img src={src} alt={t('photoAlt', { number: i + 1 })} className="w-full h-full object-cover" />
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
                  onClick={() => remove(i)}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={t('removePhoto')}
                >
                  <X className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-[90px] h-[90px] flex items-center justify-center border border-dashed border-border rounded-control text-ink-subtle hover:border-primary/50 hover:text-primary transition-colors"
            aria-label={t('addPhoto')}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePick}
        className="hidden"
      />
    </div>
  )
}
