'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tags, Plus, CornerDownRight } from 'lucide-react'
import { Category } from '@/types'
import { categoriesService } from '@/services/categories'
import { useAuth } from '@/contexts/AuthContext'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'

function slugify(label: string): string {
  return label
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function AdminCategoriesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [subLabels, setSubLabels] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (!user?.is_admin) return
    categoriesService.admin.listAll().then(setCategories).finally(() => setLoading(false))
  }, [user?.is_admin])

  const createCategory = async () => {
    if (!newLabel.trim()) return
    setCreating(true)
    setError('')
    try {
      await categoriesService.admin.create({ key: slugify(newLabel), label: newLabel.trim() })
      const updated = await categoriesService.admin.listAll()
      setCategories(updated)
      setNewLabel('')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao criar categoria')
    } finally {
      setCreating(false)
    }
  }

  const toggleCategory = async (key: string, isActive: boolean) => {
    setBusy(key)
    try {
      const updated = await categoriesService.admin.update(key, { is_active: !isActive })
      setCategories((prev) => prev.map((c) => (c.key === key ? updated : c)))
    } finally {
      setBusy(null)
    }
  }

  const renameCategory = async (key: string, label: string) => {
    if (!label.trim()) return
    const updated = await categoriesService.admin.update(key, { label: label.trim() })
    setCategories((prev) => prev.map((c) => (c.key === key ? updated : c)))
  }

  const createSubcategory = async (categoryKey: string) => {
    const label = subLabels[categoryKey]?.trim()
    if (!label) return
    setBusy(`${categoryKey}:new`)
    setError('')
    try {
      const updated = await categoriesService.admin.createSubcategory(categoryKey, { key: slugify(label), label })
      setCategories((prev) => prev.map((c) => (c.key === categoryKey ? updated : c)))
      setSubLabels((prev) => ({ ...prev, [categoryKey]: '' }))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao criar subcategoria')
    } finally {
      setBusy(null)
    }
  }

  const toggleSubcategory = async (categoryKey: string, subKey: string, isActive: boolean) => {
    setBusy(subKey)
    try {
      const updated = await categoriesService.admin.updateSubcategory(categoryKey, subKey, { is_active: !isActive })
      setCategories((prev) => prev.map((c) => (c.key === categoryKey ? updated : c)))
    } finally {
      setBusy(null)
    }
  }

  const renameSubcategory = async (categoryKey: string, subKey: string, label: string) => {
    if (!label.trim()) return
    const updated = await categoriesService.admin.updateSubcategory(categoryKey, subKey, { label: label.trim() })
    setCategories((prev) => prev.map((c) => (c.key === categoryKey ? updated : c)))
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Tags className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gerenciamento de categorias</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Crie, edite ou desative categorias e subcategorias de item — desativar só esconde de novos anúncios, itens já cadastrados mantêm a categoria.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-1">
          <Input
            label="Nova categoria"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Instrumentos musicais"
            onKeyDown={(e) => e.key === 'Enter' && createCategory()}
          />
        </div>
        <Button size="sm" onClick={createCategory} loading={creating} disabled={!newLabel.trim()}>
          <Plus className="w-3.5 h-3.5" /> Criar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => (
            <div key={c.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={c.label}
                  onBlur={(e) => e.target.value !== c.label && renameCategory(c.key, e.target.value)}
                  className="flex-1 min-w-0 font-medium text-gray-900 dark:text-gray-100 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-green-500 rounded-md px-2 py-1 text-sm focus:outline-none transition-colors"
                />
                {!c.is_active && <Badge variant="red">Inativa</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === c.key}
                  onClick={() => toggleCategory(c.key, c.is_active)}
                >
                  {c.is_active ? 'Desativar' : 'Ativar'}
                </Button>
              </div>

              <div className="mt-3 ml-2 pl-3 border-l-2 border-gray-100 dark:border-gray-700 space-y-2">
                {c.subcategories.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <input
                      defaultValue={s.label}
                      onBlur={(e) => e.target.value !== s.label && renameSubcategory(c.key, s.key, e.target.value)}
                      className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-green-500 rounded-md px-2 py-1 focus:outline-none transition-colors"
                    />
                    {!s.is_active && <Badge variant="red">Inativa</Badge>}
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === s.key}
                      onClick={() => toggleSubcategory(c.key, s.key, s.is_active)}
                    >
                      {s.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <CornerDownRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  <input
                    value={subLabels[c.key] ?? ''}
                    onChange={(e) => setSubLabels((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && createSubcategory(c.key)}
                    placeholder="Nova subcategoria..."
                    className="flex-1 min-w-0 text-sm bg-transparent border border-dashed border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:border-green-500 transition-colors"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === `${c.key}:new`}
                    onClick={() => createSubcategory(c.key)}
                    disabled={!subLabels[c.key]?.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
