'use client'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Leaf, Menu, X, LayoutDashboard, LogOut, Plus, UserCog, MailWarning, Sun, Moon, ShieldAlert, ShieldCheck, ShieldQuestion, BarChart3, Users, Package, Shield, ChevronDown, History, Settings as SettingsIcon, UsersRound, Megaphone, Download, Tags, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { platformSettingsService } from '@/services/platformSettings'
import { getViewAsTargetId, exitViewAs, clearViewAsMarkers } from '@/lib/tokenStorage'
import Button from '@/components/ui/Button'
import NotificationBell from '@/components/layout/NotificationBell'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

const ANNOUNCEMENT_DISMISSED_KEY = 'lendly:announcement-dismissed'

const ADMIN_LINKS = [
  { href: '/admin/dashboard', key: 'dashboard', icon: BarChart3 },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/items', key: 'items', icon: Package },
  { href: '/admin/groups', key: 'groups', icon: UsersRound },
  { href: '/admin/moderation', key: 'moderation', icon: ShieldAlert },
  { href: '/admin/verification', key: 'verification', icon: ShieldCheck },
  { href: '/admin/actions', key: 'actions', icon: History },
  { href: '/admin/settings', key: 'settings', icon: SettingsIcon },
  { href: '/admin/export', key: 'export', icon: Download },
  { href: '/admin/categories', key: 'categories', icon: Tags },
] as const

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Common.Navbar')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    platformSettingsService.announcement().then((a) => {
      if (a.active && a.message && localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) !== a.message) {
        setAnnouncement(a.message)
      }
    })
  }, [])

  const dismissAnnouncement = () => {
    if (announcement) localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, announcement)
    setAnnouncement(null)
  }

  // Self-healing: if the view-as access token silently expired and the
  // axios interceptor refreshed back to the admin's real token (see
  // tokenStorage.ts), user.id no longer matches the stored target — clear
  // the stale marker instead of showing a banner for a session that's
  // already over.
  const viewAsTargetId = getViewAsTargetId()
  const viewAsActive = !!(viewAsTargetId && user?.id === viewAsTargetId)
  useEffect(() => {
    if (viewAsTargetId && user && user.id !== viewAsTargetId) {
      clearViewAsMarkers()
    }
  }, [viewAsTargetId, user])

  const exitViewAsMode = () => {
    exitViewAs()
    window.location.href = '/admin/users'
  }

  useEffect(() => {
    if (!adminMenuOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [adminMenuOpen])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors">
      {viewAsActive && user && (
        <div className="bg-purple-600 px-4 py-2 flex items-center justify-center gap-2 text-white text-xs font-medium">
          <Eye className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('viewAsMode', { name: user.trade_name || user.name })}</span>
          <button
            onClick={exitViewAsMode}
            className="ml-1 underline hover:text-purple-100 flex-shrink-0"
          >
            {t('exit')}
          </button>
        </div>
      )}
      {announcement && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex items-center justify-center gap-2 text-blue-800 dark:text-blue-300 text-xs">
          <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{announcement}</span>
          <button
            onClick={dismissAnnouncement}
            aria-label={t('closeAnnouncement')}
            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-100 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {isAuthenticated && user && !user.is_verified && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
          <MailWarning className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('verifyEmail')}</span>
          <Link href="/profile" className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-200">
            {t('resendLink')}
          </Link>
        </div>
      )}
      {isAuthenticated && user && user.identity_status !== 'approved' && (
        <div className="bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800 px-4 py-2 flex items-center justify-center gap-2 text-purple-800 dark:text-purple-300 text-xs">
          <ShieldQuestion className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {user.identity_status === 'pending' && t('identityPending')}
            {user.identity_status === 'rejected' && t('identityRejected')}
            {user.identity_status === 'none' && t('identityNone')}
          </span>
          {user.identity_status !== 'pending' && (
            <Link href="/profile#identity-verification" className="font-semibold underline hover:text-purple-900 dark:hover:text-purple-200">
              {user.identity_status === 'rejected' ? t('identityResend') : t('identityVerifyNow')}
            </Link>
          )}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-green-600 dark:text-green-400">
          <Leaf className="w-6 h-6" />
          Lendly
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/items"
            className={`text-sm font-medium transition-colors ${pathname === '/items' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            {t('exploreItems')}
          </Link>
          <Link
            href="/empresas"
            className={`text-sm font-medium transition-colors ${pathname === '/empresas' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            {t('companies')}
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/groups"
                className={`text-sm font-medium transition-colors ${pathname.startsWith('/groups') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                {t('groups')}
              </Link>
              {!user?.is_admin && (
                <Link href="/items/new">
                  <Button size="sm" variant="secondary">
                    <Plus className="w-4 h-4" /> {t('newItem')}
                  </Button>
                </Link>
              )}
              <Link href="/dashboard">
                <Button size="sm" variant="ghost">
                  <LayoutDashboard className="w-4 h-4" />
                  {user?.name.split(' ')[0]}
                </Button>
              </Link>
              <Link href="/profile" title={t('editProfile')}>
                <Button size="sm" variant="ghost">
                  <UserCog className="w-4 h-4" />
                </Button>
              </Link>
              <NotificationBell />
              {user?.is_admin && (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    onClick={() => setAdminMenuOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title={t('administration')}
                  >
                    <Shield className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {adminMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1.5 z-50">
                      {ADMIN_LINKS.map(({ href, key, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setAdminMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          {t(`admin.${key}`)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <LanguageSwitcher />
              <button
                onClick={toggleTheme}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={t('logout')}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={toggleTheme}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link href="/login">
                <Button variant="outline" size="sm">{t('login')}</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">{t('createAccount')}</Button>
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher compact />
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400"
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {isAuthenticated && (
            <div className="p-2">
              <NotificationBell />
            </div>
          )}
          <button className="p-2 text-gray-700 dark:text-gray-200" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-3">
          <Link href="/items" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('exploreItems')}</Link>
          <Link href="/empresas" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('companies')}</Link>
          {isAuthenticated ? (
            <>
              <Link href="/groups" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('groups')}</Link>
              {!user?.is_admin && (
                <Link href="/items/new" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('newItem')}</Link>
              )}
              <Link href="/dashboard" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('dashboardLink')}</Link>
              <Link href="/profile" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('editProfile')}</Link>
              {user?.is_admin && ADMIN_LINKS.map(({ href, key }) => (
                <Link key={href} href={href} className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t(`admin.${key}`)}</Link>
              ))}
              <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="block text-red-600 dark:text-red-400 py-2">{t('logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-gray-700 dark:text-gray-200 py-2" onClick={() => setMobileOpen(false)}>{t('login')}</Link>
              <Link href="/register" className="block text-green-600 dark:text-green-400 font-medium py-2" onClick={() => setMobileOpen(false)}>{t('createAccount')}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
