'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Plus, X } from 'lucide-react'
import { itemsService } from '@/services/items'

const MAX_PHOTOS = 8

export default function ItemPhotoUploader({
  itemId,
  photos,
  onChange,
}: {
  itemId: string
  photos: string[]
  onChange: (photos: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

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
      setError(err.response?.data?.detail || 'Erro ao enviar foto')
    } finally {
      setUploading(false)
    }
  }

  // Removal is deferred: it only takes effect when the surrounding form is
  // saved (PUT with the reduced `photos` list) — there's no per-photo
  // delete endpoint. Upload, on the other hand, happens immediately.
  const remove = (url: string) => onChange(photos.filter((p) => p !== url))

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fotos</label>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {photos.map((url) => (
          <div
            key={url}
            className="relative w-[90px] h-[90px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          >
            <Image src={url} alt="" fill unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-[90px] h-[90px] flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 dark:text-gray-500 hover:border-green-400 dark:hover:border-green-600 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
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
