'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ChangePasswordModal({ onClose, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.ChangePasswordModal')

  const submit = async () => {
    if (!currentPassword || !newPassword) return setError(t('errorBothFields'))
    if (newPassword.length < 6) return setError(t('errorMinLength'))
    setLoading(true)
    setError('')
    try {
      await usersService.changePassword(currentPassword, newPassword)
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
        <p className="text-sm text-ink-muted">
          {t('notice')}
        </p>

        <PasswordInput
          label={t('currentPassword')}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <PasswordInput
          label={t('newPassword')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          required
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            loading={loading}
            disabled={!currentPassword || !newPassword}
            onClick={submit}
            className="flex-1"
          >
            {t('title')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
