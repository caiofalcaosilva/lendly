'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, MapPin, Star } from 'lucide-react'
import { BusinessSummary } from '@/types'
import { usersService } from '@/services/users'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ReliabilityBadge from '@/components/ui/ReliabilityBadge'

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersService.listBusinesses().then(setBusinesses).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Empresas</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Comércios locais cadastrados no Lendly — locadoras, lojas de equipamentos e outros negócios do bairro.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-green-600" /></div>
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhuma empresa cadastrada ainda"
          description="Empresas que se cadastrarem no Lendly aparecem aqui."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((biz) => (
            <Link
              key={biz.id}
              href={`/users/${biz.id}`}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{biz.trade_name || biz.company_name || biz.name}</p>
                  {biz.business_category && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{biz.business_category}</p>
                  )}
                </div>
              </div>

              {(biz.neighborhood || biz.city) && (
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {[biz.neighborhood, biz.city].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{biz.average_rating.toFixed(1)}</span>
                </div>
                <ReliabilityBadge score={biz.reliability_score} count={biz.reliability_count} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
