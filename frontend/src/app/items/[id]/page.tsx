'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  MapPin, Star, Tag, Package, AlertTriangle, ArrowLeft, Edit, Trash2,
} from 'lucide-react'
import { Item } from '@/types'
import { itemsService } from '@/services/items'
import { getCategoryLabel, formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import RequestModal from '@/components/requests/RequestModal'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequest, setShowRequest] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    itemsService.get(id).then(setItem).finally(() => setLoading(false))
  }, [id])

  const isOwner = user?.id === item?.owner.id

  const handleDelete = async () => {
    if (!confirm('Remover este item?')) return
    setDeleting(true)
    try {
      await itemsService.delete(id)
      router.push('/dashboard')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Spinner className="w-8 h-8 text-green-600" />
    </div>
  )

  if (!item) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-700">Item não encontrado</h2>
      <Link href="/items" className="text-green-600 text-sm mt-3 inline-block">← Voltar aos itens</Link>
    </div>
  )

  const photos = item.photos?.filter(Boolean) ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/items" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar aos itens
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Photos */}
        <div>
          <div className="relative aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden">
            {photos.length > 0 ? (
              <Image
                src={photos[activePhoto]}
                alt={item.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-300" />
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 mt-3">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activePhoto ? 'border-green-500' : 'border-transparent'}`}
                >
                  <Image src={photo} alt="" fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="gray">{getCategoryLabel(item.category)}</Badge>
                {item.availability_type === 'free' ? (
                  <Badge variant="green">Gratuito</Badge>
                ) : (
                  <Badge variant="blue">Aluguel</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
            </div>
            {isOwner && (
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/items/${item.id}/edit`}>
                  <Button size="sm" variant="outline"><Edit className="w-4 h-4" /></Button>
                </Link>
                <Button size="sm" variant="danger" loading={deleting} onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {item.availability_type === 'paid' && item.daily_rate && (
            <div className="text-2xl font-bold text-green-600 mb-4">
              {formatCurrency(item.daily_rate)}<span className="text-base font-normal text-gray-500">/dia</span>
            </div>
          )}

          {(item.neighborhood || item.city) && (
            <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-5">
              <MapPin className="w-4 h-4" />
              {[item.neighborhood, item.city].filter(Boolean).join(', ')}
            </div>
          )}

          {item.description && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Descrição</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
            </div>
          )}

          {item.usage_rules && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">Regras de uso</h3>
              </div>
              <p className="text-sm text-amber-700">{item.usage_rules}</p>
            </div>
          )}

          {/* Owner */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Anunciado por</p>
                <Link href={`/users/${item.owner.id}`} className="font-medium text-gray-900 hover:text-green-600 transition-colors">
                  {item.owner.name}
                </Link>
                {item.owner.city && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[item.owner.neighborhood, item.owner.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{item.owner.average_rating.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {!isOwner && (
            <div>
              {!isAuthenticated ? (
                <Link href={`/login?redirect=/items/${item.id}`}>
                  <Button className="w-full" size="lg">
                    Entrar para solicitar
                  </Button>
                </Link>
              ) : !item.is_available ? (
                <div className="bg-gray-100 text-gray-500 text-center py-3 px-4 rounded-lg text-sm">
                  Item temporariamente indisponível
                </div>
              ) : (
                <Button className="w-full" size="lg" onClick={() => setShowRequest(true)}>
                  {item.availability_type === 'free' ? 'Solicitar empréstimo' : 'Solicitar aluguel'}
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">
            Publicado em {formatDate(item.created_at)}
          </p>
        </div>
      </div>

      {showRequest && (
        <RequestModal item={item} onClose={() => setShowRequest(false)} />
      )}
    </div>
  )
}
