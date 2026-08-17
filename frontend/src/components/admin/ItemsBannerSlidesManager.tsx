'use client'
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ItemsBannerSlide } from '@/types'
import { itemsBannerSlidesService } from '@/services/itemsBannerSlides'
import Tooltip from '@/components/ui/Tooltip'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'

const MAX_SLIDES = 8

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/// Each action here persists immediately (upload/remove/reorder/link edit
/// all call the API directly) — unlike the rest of /admin/settings, which
/// batches edits behind a single "Salvar alterações" button, there's no
/// draft state to save: a slide either exists on the server or it doesn't.
export default function ItemsBannerSlidesManager() {
  const t = useTranslations('Admin.ItemsBannerSlides')
  const inputRef = useRef<HTMLInputElement>(null)
  const [slides, setSlides] = useState<ItemsBannerSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    itemsBannerSlidesService.list().then(setSlides).finally(() => setLoading(false))
  }, [])

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const slide = await itemsBannerSlidesService.upload(file)
      setSlides((prev) => [...prev, slide])
    } catch (err: any) {
      setError(err.response?.data?.detail || t('errorUpload'))
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== id))
    await itemsBannerSlidesService.remove(id)
  }

  const drop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      return
    }
    const next = reorder(slides, dragIndex, index)
    setSlides(next)
    setDragIndex(null)
    await itemsBannerSlidesService.reorder(next.map((s) => s.id))
  }

  const updateLink = async (id: string, linkUrl: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, link_url: linkUrl } : s)))
    await itemsBannerSlidesService.updateLink(id, linkUrl)
  }

  if (loading) {
    return <div className="flex justify-center py-6"><Spinner className="w-5 h-5 text-primary" /></div>
  }

  return (
    <div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            className="w-32 cursor-grab active:cursor-grabbing"
          >
            <div className="relative w-32 h-20 rounded-control overflow-hidden border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded public URL, arbitrary R2/disk host not worth adding to next/image's domain allowlist */}
              <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-1 right-1">
                <Tooltip label={t('removeSlide')}>
                  <button
                    type="button"
                    onClick={() => remove(slide.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label={t('removeSlide')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            </div>
            <Input
              defaultValue={slide.link_url ?? ''}
              onBlur={(e) => {
                if (e.target.value !== (slide.link_url ?? '')) updateLink(slide.id, e.target.value)
              }}
              placeholder={t('linkPlaceholder')}
              className="mt-1 text-xs px-2 py-1"
            />
          </div>
        ))}
        {slides.length < MAX_SLIDES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-32 h-20 flex items-center justify-center border border-dashed border-border rounded-control text-ink-subtle hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            aria-label={t('addSlide')}
          >
            {uploading ? <Spinner className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
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
