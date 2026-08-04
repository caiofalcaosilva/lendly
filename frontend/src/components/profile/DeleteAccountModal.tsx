'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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

  const submit = async () => {
    if (!password) return setError('Informe sua senha')
    setLoading(true)
    setError('')
    try {
      await usersService.deleteAccount(password)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao excluir a conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Excluir conta">
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Essa ação não pode ser desfeita. Seus dados pessoais serão apagados, seus itens
            desativados, e você será removido dos grupos que participa. Avaliações e histórico de
            empréstimos com outras pessoas continuam existindo, mas passam a mostrar
            "Usuário removido".
          </p>
        </div>

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
          <Button variant="danger" loading={loading} disabled={!password} onClick={submit} className="flex-1">
            Excluir minha conta
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
