import { cn } from '@/lib/utils'

/// Pure-CSS tooltip (hover + focus-within, no JS state needed) — replaces
/// the native `title` attribute, which is slow to appear and unstyled.
export default function Tooltip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-flex group/tooltip', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 max-w-[min(80vw,220px)] whitespace-normal text-center rounded-md bg-ink px-2.5 py-1 text-xs text-bg opacity-0 transition-opacity group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}
