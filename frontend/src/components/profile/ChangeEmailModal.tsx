'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usersService } from '@/services/users'
import { User } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  onClose: () => void
  onSuccess: (updated: User) => void
}

export default function ChangeEmailModal({ onClose, onSuccess }: Props) {
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.ChangeEmailModal')

  const submit = async () => {
    if (!newEmail || !password) return setError(t('errorBothFields'))
    setLoading(true)
    setError('')
    try {
      const updated = await usersService.changeEmail(newEmail, password)
      onSuccess(updated)
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

        <Input
          label={t('newEmail')}
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="novo@email.com"
          required
        />
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
          <Button loading={loading} disabled={!newEmail || !password} onClick={submit} className="flex-1">
            {t('title')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
