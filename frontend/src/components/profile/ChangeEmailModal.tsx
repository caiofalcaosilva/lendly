'use client'
import { useState } from 'react'
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

  const submit = async () => {
    if (!newEmail || !password) return setError('Preencha os dois campos')
    setLoading(true)
    setError('')
    try {
      const updated = await usersService.changeEmail(newEmail, password)
      onSuccess(updated)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao trocar o e-mail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Trocar e-mail">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Você vai precisar verificar o novo e-mail antes de usar a conta normalmente de novo.
        </p>

        <Input
          label="Novo e-mail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="novo@email.com"
          required
        />
        <Input
          label="Confirme sua senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button loading={loading} disabled={!newEmail || !password} onClick={submit} className="flex-1">
            Trocar e-mail
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
