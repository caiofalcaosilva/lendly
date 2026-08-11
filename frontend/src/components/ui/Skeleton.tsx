import { cn } from '@/lib/utils'

// A single pulsing placeholder block — compose these into content-shaped
// skeletons (see SkeletonCard/SkeletonRow usages) instead of a full-page
// Spinner, so the layout doesn't jump when data arrives.
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn('motion-safe:animate-pulse bg-surface-2 rounded', className)} />
}
