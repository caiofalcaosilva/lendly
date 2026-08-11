import { cn } from '@/lib/utils'

// Two mirrored leaf shapes in rotational symmetry — standing for an item
// circulating between neighbors (lent out, then returned), rather than a
// single static leaf that would only read as "nature/green" in general.
const LEAF_PATH = 'M12,12 C6,12 5,6 9,3.2 C10.6,2.1 13,2.3 13.8,4 C15,6.6 13,10 12,12 Z'

export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" className="fill-primary" />
      <path d={LEAF_PATH} className="fill-primary-on" />
      <path d={LEAF_PATH} className="fill-primary-on" opacity={0.4} transform="rotate(180 12 12)" />
    </svg>
  )
}

export function Logo({ className, markClassName = 'w-7 h-7' }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="font-extrabold text-lg tracking-tight text-primary">Lendly</span>
    </span>
  )
}
