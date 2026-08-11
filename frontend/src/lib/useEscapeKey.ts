import { useEffect } from 'react'

// Shared by dropdowns (UserMenu, NotificationBell) that already close on
// click-outside but, until now, ignored the keyboard entirely.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onEscape])
}
