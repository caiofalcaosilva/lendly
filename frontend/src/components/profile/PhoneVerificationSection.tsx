'use client'
import { useEffect, useRef, useState } from 'react'
import { PhoneCall, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { User } from '@/types'
import { authService } from '@/services/auth'
import Button from '@/components/ui/Button'
import CodeInput, { CodeInputHandle } from '@/components/ui/CodeInput'

interface Props {
  user: User
  updateUser: (user: User) => void
}

const RESEND_COOLDOWN_SECONDS = 60

export default function PhoneVerificationSection({ user, updateUser }: Props) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const codeInput = useRef<CodeInputHandle>(null)
  const t = useTranslations('Common.PhoneVerificationSection')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const sendCode = async () => {
    setSending(true)
    setError('')
    try {
      await authService.sendPhoneVerificationCode()
      setOpen(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorSending'))
    } finally {
      setSending(false)
    }
  }

  const confirm = async () => {
    if (code.length < 6) return
    setVerifying(true)
    setError('')
    try {
      const updated = await authService.verifyPhoneCode(code)
      updateUser(updated)
      setOpen(false)
      setCode('')
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorInvalidCode'))
      codeInput.current?.reset()
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="p-4 rounded-panel border border-border bg-surface-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {user.phone_verified ? (
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          ) : (
            <ShieldQuestion className="w-5 h-5 text-ink-subtle mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-ink">{t('title')}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {user.phone_verified
                ? t('verified')
                : user.phone
                  ? t('notVerified')
                  : t('noPhone')}
            </p>
          </div>
        </div>
        {!user.phone_verified && user.phone && !open && (
          <Button size="sm" onClick={sendCode} loading={sending}>
            {t('verifyButton')}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <p className="text-xs text-ink-muted flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5" /> {t('codeSentTo', { phone: user.phone ?? '' })}
          </p>
          <CodeInput ref={codeInput} onChange={setCode} />
          {error && <p className="text-center text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={confirm} loading={verifying} disabled={code.length < 6}>
              {t('confirm')}
            </Button>
            <button
              type="button"
              onClick={sendCode}
              disabled={cooldown > 0 || sending}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
