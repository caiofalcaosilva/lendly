'use client'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Menu, X, Plus, MailWarning, Sun, Moon, ShieldQuestion, Megaphone, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { platformSettingsService } from '@/services/platformSettings'
import { getViewAsTargetId, exitViewAs, clearViewAsMarkers } from '@/lib/tokenStorage'
import Button from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import NotificationBell from '@/components/layout/NotificationBell'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import UserMenu from '@/components/layout/UserMenu'
import { ADMIN_LINKS } from './adminLinks'

const ANNOUNCEMENT_DISMISSED_KEY = 'lendly:announcement-dismissed'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Common.Navbar')
  const [mobileOpen, setMobileOpen] = useState(false)
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

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const themeToggleLabel = theme === 'dark' ? t('lightMode') : t('darkMode')

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-40 transition-colors">
      {viewAsActive && user && (
        <div className="bg-accent px-4 py-2 flex items-center justify-center gap-2 text-accent-on text-xs font-medium">
          <Eye className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('viewAsMode', { name: user.trade_name || user.name })}</span>
          <button
            onClick={exitViewAsMode}
            className="ml-1 underline hover:opacity-75 flex-shrink-0"
          >
            {t('exit')}
          </button>
        </div>
      )}
      {announcement && (
        <div className="bg-info-subtle border-b border-info/30 px-4 py-2 flex items-center justify-center gap-2 text-info text-xs">
          <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{announcement}</span>
          <button
            onClick={dismissAnnouncement}
            aria-label={t('closeAnnouncement')}
            className="ml-1 hover:opacity-75 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {isAuthenticated && user && !user.is_verified && (
        <div className="bg-warning-subtle border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2 text-warning text-xs">
          <MailWarning className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('verifyEmail')}</span>
          <Link href="/profile" className="font-semibold underline hover:opacity-75">
            {t('resendLink')}
          </Link>
        </div>
      )}
      {isAuthenticated && user && user.identity_status !== 'approved' && (
        <div className="bg-accent-subtle border-b border-accent/30 px-4 py-2 flex items-center justify-center gap-2 text-accent text-xs">
          <ShieldQuestion className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {user.identity_status === 'pending' && t('identityPending')}
            {user.identity_status === 'rejected' && t('identityRejected')}
            {user.identity_status === 'none' && t('identityNone')}
          </span>
          {user.identity_status !== 'pending' && (
            <Link href="/profile#identity-verification" className="font-semibold underline hover:opacity-75">
              {user.identity_status === 'rejected' ? t('identityResend') : t('identityVerifyNow')}
            </Link>
          )}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/items"
            className={`text-sm font-medium transition-colors ${pathname === '/items' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
          >
            {t('exploreItems')}
          </Link>
          <Link
            href="/empresas"
            className={`text-sm font-medium transition-colors ${pathname === '/empresas' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
          >
            {t('companies')}
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/groups"
                className={`text-sm font-medium transition-colors ${pathname.startsWith('/groups') ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
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
              <NotificationBell />
              <div className="flex items-center gap-3 pl-3 ml-1 border-l border-border">
                <LanguageSwitcher />
                <button
                  onClick={toggleTheme}
                  aria-label={themeToggleLabel}
                  className="text-ink-muted hover:text-ink transition-colors"
                  title={themeToggleLabel}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <UserMenu />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                className="text-ink-muted hover:text-ink transition-colors"
                title={themeToggleLabel}
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
            aria-label={themeToggleLabel}
            className="p-2 text-ink-muted"
            title={themeToggleLabel}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {isAuthenticated && (
            <div className="p-2">
              <NotificationBell />
            </div>
          )}
          <button
            className="p-2 text-ink"
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-surface border-t border-border px-4 py-4 space-y-3">
          <Link href="/items" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('exploreItems')}</Link>
          <Link href="/empresas" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('companies')}</Link>
          {isAuthenticated ? (
            <>
              <Link href="/groups" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('groups')}</Link>
              {!user?.is_admin && (
                <Link href="/items/new" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('newItem')}</Link>
              )}
              <div className="border-t border-border my-1" />
              <Link href="/dashboard" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('dashboardLink')}</Link>
              <Link href="/profile" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('editProfile')}</Link>
              <Link href="/activities" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('activityHistory')}</Link>
              {user?.is_admin && ADMIN_LINKS.map(({ href, key }) => (
                <Link key={href} href={href} className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t(`admin.${key}`)}</Link>
              ))}
              <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="block text-danger py-2">{t('logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-ink-muted py-2" onClick={() => setMobileOpen(false)}>{t('login')}</Link>
              <Link href="/register" className="block text-primary font-medium py-2" onClick={() => setMobileOpen(false)}>{t('createAccount')}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
