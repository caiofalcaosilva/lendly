'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteAccountModal({ onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.DeleteAccountModal')

  const submit = async () => {
    if (!password) return setError(t('errorPasswordRequired'))
    setLoading(true)
    setError('')
    try {
      await usersService.deleteAccount(password)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('title')}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-danger-subtle border border-danger/30 rounded-control p-3">
          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">
            {t('warning')}
          </p>
        </div>

        <Input
          label={t('confirmPassword')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="danger" loading={loading} disabled={!password} onClick={submit} className="flex-1">
            {t('submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
