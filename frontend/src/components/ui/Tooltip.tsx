'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const GAP = 6
const VIEWPORT_MARGIN = 8

/// Portal-based tooltip — renders into document.body instead of inline, so
/// it can never be clipped by an ancestor's `overflow-hidden`/`overflow-x-auto`
/// (cards, tables, the mobile nav sheet) or lost behind a lower stacking
/// context. Position is measured from the trigger + bubble's real
/// bounding boxes after mount, then clamped to the viewport and flipped
/// below the trigger when there isn't room above — a fixed CSS offset
/// can't do either of those.
export default function Tooltip({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<{ top: number; left: number; opacity: number }>({
    top: 0,
    left: 0,
    opacity: 0,
  })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !bubbleRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const bubble = bubbleRef.current.getBoundingClientRect()

    let left = trigger.left + trigger.width / 2 - bubble.width / 2
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      window.innerWidth - bubble.width - VIEWPORT_MARGIN,
    )

    let top = trigger.top - bubble.height - GAP
    if (top < VIEWPORT_MARGIN) {
      top = trigger.bottom + GAP
    }

    setStyle({ top, left, opacity: 1 })
  }, [open, label])

  // Position is measured once on open, not tracked continuously — close
  // instead of leaving a stale bubble floating over the wrong spot if the
  // page scrolls or resizes while it's up.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <span
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            id={id}
            ref={bubbleRef}
            role="tooltip"
            style={{ top: style.top, left: style.left, opacity: style.opacity }}
            className="pointer-events-none fixed z-[60] max-w-[min(80vw,220px)] whitespace-normal text-center rounded-md bg-ink px-2.5 py-1 text-xs text-bg transition-opacity"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}
