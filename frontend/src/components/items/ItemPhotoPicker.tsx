'use client'
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'

const MAX_PHOTOS = 8

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])

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

  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-2">Fotos</label>
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div
            key={src}
            className="relative w-[90px] h-[90px] rounded-control overflow-hidden border border-border bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize these */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remover foto"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-[90px] h-[90px] flex items-center justify-center border border-dashed border-border rounded-control text-ink-subtle hover:border-primary/50 hover:text-primary transition-colors"
            aria-label="Adicionar foto"
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
