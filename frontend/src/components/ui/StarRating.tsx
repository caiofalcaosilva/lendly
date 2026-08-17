'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/// Read-only (`ReviewCard`) and interactive-input (`ReviewModal`) star
/// rating, unified — pass `onChange` to get the input variant.
export default function StarRating({
  rating,
  onChange,
  size = 'sm',
  className,
}: {
  rating: number
  onChange?: (value: number) => void
  size?: 'sm' | 'lg'
  className?: string
}) {
  const [hovered, setHovered] = useState(0)
  const interactive = !!onChange
  const display = interactive ? hovered || rating : rating
  const iconSize = size === 'lg' ? 'w-8 h-8' : 'w-3.5 h-3.5'
  const gap = size === 'lg' ? 'gap-2' : 'gap-0.5'

  return (
    <div className={cn('flex', gap, className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Star className={cn(iconSize, n <= display ? 'fill-yellow-400 text-yellow-400' : 'text-ink-subtle')} />
        if (!interactive) return <span key={n}>{star}</span>
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        )
      })}
    </div>
  )
}
