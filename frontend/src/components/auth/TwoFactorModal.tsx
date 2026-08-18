'use client'
import { useState, useRef } from 'react'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import CodeInput, { CodeInputHandle } from '@/components/ui/CodeInput'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  tempToken: string
  onSuccess: () => void
  onClose: () => void
}

export default function TwoFactorModal({ tempToken, onSuccess, onClose }: Props) {
  const { completeTwoFactor } = useAuth()
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const codeInput = useRef<CodeInputHandle>(null)
  const t = useTranslations('Common.TwoFactorModal')

  const submit = async () => {
    if (code.length < 6) return setError(t('errorSixDigits'))
    setLoading(true)
    setError('')
    try {
      await completeTwoFactor(tempToken, code, trustDevice)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorInvalidCode'))
      codeInput.current?.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title')}>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-14 h-14 bg-primary-subtle rounded-full flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm text-ink-muted">
              {t('instructions')}
            </p>
            <p className="text-xs text-ink-subtle mt-1 flex items-center justify-center gap-1">
              <Smartphone className="w-3 h-3" /> {t('appExamples')}
            </p>
          </div>
        </div>

        <CodeInput ref={codeInput} onChange={setCode} />

        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <Checkbox checked={trustDevice} onChange={setTrustDevice} label={t('trustDevice')} />

        <div className="flex gap-3">
          <Button
            onClick={submit}
            loading={loading}
            disabled={code.length < 6}
            className="flex-1"
          >
            {t('verify')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
