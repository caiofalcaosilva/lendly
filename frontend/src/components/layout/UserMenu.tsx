'use client'
import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, History, LayoutDashboard, LogOut, Shield, UserCog } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { ADMIN_LINKS } from './adminLinks'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const t = useTranslations('Common.Navbar')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEscapeKey(open, () => setOpen(false))

  if (!user) return null

  const displayName = user.trade_name || user.name
  const firstName = user.name.split(' ')[0]

  const close = () => setOpen(false)

  const handleLogout = () => {
    close()
    logout()
    router.push('/')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-surface-2 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('accountMenu')}
      >
        <Avatar name={displayName} avatarUrl={user.avatar_url} size="sm" />
        <span className="text-sm font-medium text-ink-muted max-w-[7rem] truncate">
          {firstName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-panel shadow-overlay py-1.5 z-50">
          <div className="px-3.5 py-2 border-b border-border">
            <p className="text-sm font-semibold text-ink truncate">
              {displayName}
            </p>
            <p className="text-xs text-ink-muted truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-muted hover:bg-surface-2 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-ink-subtle flex-shrink-0" />
              {t('dashboardLink')}
            </Link>
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-muted hover:bg-surface-2 transition-colors"
            >
              <UserCog className="w-4 h-4 text-ink-subtle flex-shrink-0" />
              {t('editProfile')}
            </Link>
            <Link
              href="/activities"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-muted hover:bg-surface-2 transition-colors"
            >
              <History className="w-4 h-4 text-ink-subtle flex-shrink-0" />
              {t('activityHistory')}
            </Link>
          </div>

          {user.is_admin && (
            <div className="py-1 border-t border-border">
              <p className="px-3.5 pt-1.5 pb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-subtle uppercase tracking-wide">
                <Shield className="w-3 h-3" />
                {t('administration')}
              </p>
              {ADMIN_LINKS.map(({ href, key, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-muted hover:bg-surface-2 transition-colors"
                >
                  <Icon className="w-4 h-4 text-ink-subtle flex-shrink-0" />
                  {t(`admin.${key}`)}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
