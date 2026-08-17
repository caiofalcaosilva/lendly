'use client'
import { useTranslations } from 'next-intl'
import { authService } from '@/services/auth'
import GoogleIcon from '@/components/ui/GoogleIcon'

/// "Continuar com Google" — same entry point for both login and signup
/// (the backend creates the account on first use, see auth_service/
/// google.py), so this one button covers both pages. Plain navigation,
/// not a fetch: the browser needs to actually follow the redirect to
/// Google's consent screen.
export default function GoogleButton() {
  const t = useTranslations('Common.GoogleButton')

  return (
    <button
      type="button"
      onClick={() => { window.location.href = authService.googleLoginUrl() }}
      className="w-full flex items-center justify-center gap-2.5 border border-border rounded-control px-4 py-2.5 text-sm font-medium text-ink bg-surface hover:bg-surface-2 transition-colors"
    >
      <GoogleIcon />
      {t('label')}
    </button>
  )
}
