'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

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
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('notice')}
        </p>

        <Input
          label={t('currentPassword')}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Input
          label={t('newPassword')}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          required
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
