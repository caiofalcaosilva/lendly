'use client'
import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEscapeKey } from '@/lib/useEscapeKey'

// Curated set, not a full emoji database — keeps this dependency-free and
// scoped to what's actually useful in a lending/rental conversation
// (confirmations, logistics, small talk), rather than pulling in a
// multi-hundred-KB emoji picker library for a chat that doesn't need one.
const EMOJIS = [
  '👍', '👎', '🙏', '🙌', '👋', '🤝', '✅', '❌',
  '❓', '❗', '⏰', '📅', '📦', '🏠', '🚗', '🚚',
  '📞', '💬', '💰', '🛠️', '🔑', '📷', '📚', '⚽',
  '😀', '😄', '😅', '😂', '🙂', '😊', '😉', '😍',
  '😢', '😮', '😬', '🤔', '👀', '💪', '🔥', '✨',
  '🎉', '🎁', '❤️', '💚', '👏', '🙈', '😴', '🤗',
]

export default function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useTranslations('Common.EmojiPicker')

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEscapeKey(open, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('ariaLabel')}
        aria-expanded={open}
        aria-haspopup="true"
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 rounded-control transition-colors"
      >
        <Smile className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-64 max-h-56 overflow-y-auto grid grid-cols-8 gap-0.5 p-2 bg-surface border border-border rounded-panel shadow-overlay z-50"
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(emoji)
                setOpen(false)
              }}
              className="w-7 h-7 flex items-center justify-center text-lg rounded-control hover:bg-surface-2 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
