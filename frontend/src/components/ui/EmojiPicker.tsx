'use client'
import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEscapeKey } from '@/lib/useEscapeKey'

// Curated set, not a full emoji database — keeps this dependency-free
// (no emoji-picker library, ~100+ emojis grouped by category instead of
// the full ~1,800-emoji Unicode set, which would need search/tabs to stay
// usable and isn't worth a new dependency for this chat).
const GROUPS: { labelKey: string; emojis: string[] }[] = [
  {
    labelKey: 'categorySmileys',
    emojis: ['😀', '😄', '😁', '😆', '😅', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '😘', '😋', '😜', '🤗', '🤔', '😐', '😴', '😢', '😭', '😡', '🥺', '😳'],
  },
  {
    labelKey: 'categoryGestures',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '🤝', '👋', '✌️', '🤞', '💪', '👀', '🙈', '🤷', '👌', '✋', '🫡'],
  },
  {
    labelKey: 'categoryHearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕'],
  },
  {
    labelKey: 'categoryLending',
    emojis: ['📦', '🏠', '🔑', '🚗', '🚚', '🛠️', '🔧', '🔨', '📷', '📚', '🎮', '🚲', '⚽', '🏀', '🎸', '🧺', '👕', '👗', '🎁', '💰', '📅', '⏰', '✅', '❌'],
  },
  {
    labelKey: 'categoryFood',
    emojis: ['🍕', '🍔', '🍟', '🌭', '🍎', '🍌', '🍇', '🍫', '☕', '🍺', '🍷', '🎂', '🍿', '🍪', '🥪', '🧃'],
  },
  {
    labelKey: 'categoryNature',
    emojis: ['🌞', '🌧️', '⛅', '🌈', '🔥', '✨', '🌟', '🌙', '🐶', '🐱', '🐦', '🌱'],
  },
  {
    labelKey: 'categorySymbols',
    emojis: ['❓', '❗', '💯', '🎉', '🚨', '⚠️', '💬', '📣', '🔔'],
  },
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
          className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto p-2 bg-surface border border-border rounded-panel shadow-overlay z-50"
        >
          {GROUPS.map((group) => (
            <div key={group.labelKey}>
              <p className="px-1 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                {t(group.labelKey)}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
