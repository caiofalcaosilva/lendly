'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ItemsBannerSlide } from '@/types'
import { itemsBannerSlidesService } from '@/services/itemsBannerSlides'

const AUTO_ADVANCE_MS = 5000

/// Admin-uploaded promotional carousel for the items/browse page — see
/// components/ui/AdSlot.tsx for the separate, still-unwired placeholder
/// reserved for future third-party ads. Renders nothing when there are no
/// slides. Mirrors ItemDetailClient's photo carousel (arrows + dots), with
/// auto-advance added since this is a showcase, not a gallery to browse.
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
  const image = (
    <Image
      src={slide.image_url}
      alt={t('slideAlt', { number: active + 1 })}
      fill
      className="object-cover"
      unoptimized
      priority
    />
  )

  return (
    <div className="relative aspect-[21/9] sm:aspect-[3/1] bg-surface-2 rounded-panel overflow-hidden mb-6">
      {slide.link_url ? (
        <a href={slide.link_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0">
          {image}
        </a>
      ) : (
        image
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
