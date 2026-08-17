'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ShieldCheck, Copy, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Tooltip from '@/components/ui/Tooltip'
import { authService } from '@/services/auth'
import { User } from '@/types'

// QRCode only runs on client (canvas)
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

interface Props {
  onSuccess: (updatedUser: User) => void
  onClose: () => void
}

type Step = 'scan' | 'confirm'

export default function TotpSetupModal({ onSuccess, onClose }: Props) {
  const [step, setStep] = useState<Step>('scan')
  const [uri, setUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const t = useTranslations('Common.TotpSetupModal')

  useEffect(() => {
    authService
      .setupTotp()
      .then(({ secret, uri }) => { setSecret(secret); setUri(uri) })
      .catch(() => setError(t('errorSetup')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirm = async () => {
    if (code.replace(/\D/g, '').length < 6) return setError(t('errorSixDigits'))
    setConfirming(true)
    setError('')
    try {
      const updated = await authService.enableTotp(code.replace(/\D/g, ''))
      onSuccess(updated)
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorInvalidCode'))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title')}>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      ) : step === 'scan' ? (
        <div className="space-y-5">
          <p className="text-sm text-ink-muted">
            {t('scanInstructions')}
          </p>

          <div className="flex justify-center py-2">
            {uri && <QRCodeSVG value={uri} size={200} level="M" />}
          </div>

          <div className="bg-surface-2 rounded-control p-3">
            <p className="text-xs text-ink-muted mb-1">{t('orEnterManually')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-ink-muted break-all">{secret}</code>
              <Tooltip label={t('copy')}>
                <button
                  onClick={copySecret}
                  className="flex-shrink-0 p-1.5 text-ink-subtle hover:text-ink-muted transition-colors"
                  aria-label={t('copy')}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </Tooltip>
            </div>
          </div>

          <p className="text-xs text-ink-subtle">
            {t.rich('afterAdding', { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>

          <div className="flex gap-3">
            <Button onClick={() => setStep('confirm')} className="flex-1">{t('continue')}</Button>
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <ShieldCheck className="w-10 h-10 text-primary" />
            <p className="text-sm text-ink-muted text-center">
              {t('confirmInstructions')}
            </p>
          </div>

          <Input
            label={t('verificationCode')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className="text-center text-2xl tracking-widest font-mono"
          />

          {error && <p className="text-sm text-danger text-center">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={confirm} loading={confirming} disabled={code.length < 6} className="flex-1">
              {t('activate2fa')}
            </Button>
            <Button variant="outline" onClick={() => setStep('scan')}>{t('back')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
