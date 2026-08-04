'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { groupsService } from '@/services/groups'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const group = await groupsService.create({ name, description: description || undefined })
      router.push(`/groups/${group.id}`)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao criar grupo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Criar grupo</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Um grupo privado, por convite — só quem entrar com o link vê o que for compartilhado nele.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

        <Input
          label="Nome do grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Condomínio Jardim das Flores"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading} disabled={!name.trim()} className="flex-1">
            Criar grupo
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
