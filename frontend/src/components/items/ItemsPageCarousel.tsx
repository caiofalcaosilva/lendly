'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ItemsBannerSlide } from '@/types'
import { itemsBannerSlidesService } from '@/services/itemsBannerSlides'

const AUTO_ADVANCE_MS = 5000

// Fixed pixel heights, not an aspect-ratio — width is always the full
// viewport (full-bleed), so a ratio would make the banner taller on wide
// screens and shorter on narrow ones. A fixed height keeps it visually
// consistent at every width; object-cover crops the sides of the image
// to fill it (more crop on wide screens, less on narrow ones).
const DESKTOP_HEIGHT = 300
const MOBILE_HEIGHT = 250

/// Admin-uploaded promotional carousel for the items/browse page — a
/// quick-communication banner for Lendly's own announcements/promos, not
/// third-party ads. Full-bleed at the very top of the page (rendered
/// outside the page's max-width column, no rounded corners). Desktop and
/// mobile each get their own image and fixed height — real separate
/// artwork, not one image cropped two ways — with image_url_mobile
/// falling back to image_url when a slide only has one. Renders nothing
/// when there are no slides. Mirrors ItemDetailClient's photo carousel
/// (arrows + dots), with auto-advance added since this is a showcase,
/// not a gallery to browse.
export default function ItemsPageCarousel() {
  const [slides, setSlides] = useState<ItemsBannerSlide[]>([])
  const [active, setActive] = useState(0)
  const t = useTranslations('Common.ItemsPageCarousel')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    itemsBannerSlidesService.list().then(setSlides)
  }, [])

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (slides.length > 1) {
      timerRef.current = setInterval(() => {
        setActive((prev) => (prev + 1) % slides.length)
      }, AUTO_ADVANCE_MS)
    }
  }

  useEffect(() => {
    restartTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length])

  const goTo = (index: number) => {
    setActive(index)
    restartTimer()
  }

  if (slides.length === 0) return null

  const slide = slides[active]
  const alt = t('slideAlt', { number: active + 1 })
  const frames = (
    <>
      <div className="sm:hidden relative" style={{ height: MOBILE_HEIGHT }}>
        <Image src={slide.image_url_mobile || slide.image_url} alt={alt} fill className="object-cover" priority />
      </div>
      <div className="hidden sm:block relative" style={{ height: DESKTOP_HEIGHT }}>
        <Image src={slide.image_url} alt={alt} fill className="object-cover" priority />
      </div>
    </>
  )

  return (
    <div className="relative w-full bg-surface-2 overflow-hidden">
      {slide.link_url ? (
        <a href={slide.link_url} target="_blank" rel="noopener noreferrer" className="block">
          {frames}
        </a>
      ) : (
        frames
      )}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo((active - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={t('previousSlide')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo((active + 1) % slides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={t('nextSlide')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/50'}`}
                aria-label={t('goToSlide', { number: i + 1 })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
