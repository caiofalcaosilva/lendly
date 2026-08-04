'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Users, Package, ClipboardList } from 'lucide-react'
import { adminExportService } from '@/services/adminExport'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

const REPORTS = [
  { key: 'users', label: 'Usuários', description: 'Todos os usuários, com status, tipo de conta e reputação.', icon: Users, action: adminExportService.users },
  { key: 'items', label: 'Itens', description: 'Todos os itens anunciados, com dono, categoria e status.', icon: Package, action: adminExportService.items },
  { key: 'loanRequests', label: 'Empréstimos', description: 'Todas as solicitações de empréstimo, com status e datas.', icon: ClipboardList, action: adminExportService.loanRequests },
] as const

export default function AdminExportPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, user, router])

  const handleDownload = async (key: string, action: () => Promise<void>) => {
    setDownloading(key)
    try {
      await action()
    } finally {
      setDownloading(null)
    }
  }

  if (authLoading || !user?.is_admin) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Spinner className="w-8 h-8 text-green-600" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Exportação de relatórios</h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Baixe um CSV com todos os dados de cada área, pra análise offline.
      </p>

      <div className="space-y-3">
        {REPORTS.map(({ key, label, description, icon: Icon, action }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              loading={downloading === key}
              onClick={() => handleDownload(key, action)}
              className="flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Baixar CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
