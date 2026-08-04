'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, Plus } from 'lucide-react'
import { GroupSummary } from '@/types'
import { groupsService } from '@/services/groups'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    groupsService.mine().then(setGroups).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meus grupos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Grupos privados de vizinhos, por convite — compartilhe itens só com quem você confia.
          </p>
        </div>
        <Link href="/groups/new">
          <Button>
            <Plus className="w-4 h-4" /> Criar grupo
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Você ainda não está em nenhum grupo"
          description="Crie um grupo pro seu condomínio ou sua rua, ou peça um link de convite pra alguém que já tem um."
          action={{ label: 'Criar grupo', onClick: () => router.push('/groups/new') }}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-green-300 dark:hover:border-green-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{group.name}</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {group.member_count} {group.member_count === 1 ? 'membro' : 'membros'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
