'use client'
import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, LayoutDashboard, LogOut, Shield, UserCog } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
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
        className="inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('accountMenu')}
      >
        <Avatar name={displayName} avatarUrl={user.avatar_url} size="sm" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[7rem] truncate">
          {firstName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1.5 z-50">
          <div className="px-3.5 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              {t('dashboardLink')}
            </Link>
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <UserCog className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              {t('editProfile')}
            </Link>
          </div>

          {user.is_admin && (
            <div className="py-1 border-t border-gray-100 dark:border-gray-700">
              <p className="px-3.5 pt-1.5 pb-1 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                <Shield className="w-3 h-3" />
                {t('administration')}
              </p>
              {ADMIN_LINKS.map(({ href, key, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  {t(`admin.${key}`)}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
