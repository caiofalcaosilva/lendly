'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

/// Full-size image overlay — click backdrop, Escape, or the close button to
/// dismiss. Caller owns the `open` state and renders its own clickable
/// trigger; this only renders the overlay itself.
export default function ImageLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations('Common.ImageLightbox')

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-4 right-4 p-2 rounded-control text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- full-size preview, next/image's fixed sizing model doesn't fit a viewport-clamped lightbox */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-full max-h-[90vh] object-contain rounded-control"
      />
    </div>
  )
}
