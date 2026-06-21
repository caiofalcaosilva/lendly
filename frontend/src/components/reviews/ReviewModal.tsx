'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { reviewsService } from '@/services/reviews'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  requestId: string
  reviewedName: string
  onClose: () => void
  onSuccess: () => void
}

export default function ReviewModal({ requestId, reviewedName, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating) return setError('Selecione uma nota')
    setLoading(true)
    setError('')
    try {
      await reviewsService.create(requestId, { rating, comment: comment || undefined })
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao enviar avaliação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Avaliar ${reviewedName}`}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-600 mb-3">Como foi a experiência com {reviewedName}?</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${n <= (hovered || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'][rating]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comentário (opcional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Conte como foi a experiência..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={submit} loading={loading} disabled={!rating} className="flex-1">
            Enviar avaliação
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
