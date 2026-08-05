'use client'
import { useState } from 'react'
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

  const submit = async () => {
    if (!currentPassword || !newPassword) return setError('Preencha os dois campos')
    if (newPassword.length < 6) return setError('A nova senha precisa ter pelo menos 6 caracteres')
    setLoading(true)
    setError('')
    try {
      await usersService.changePassword(currentPassword, newPassword)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao trocar a senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Trocar senha">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Você será desconectado dos outros dispositivos depois de trocar a senha.
        </p>

        <Input
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Input
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
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
            Trocar senha
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
