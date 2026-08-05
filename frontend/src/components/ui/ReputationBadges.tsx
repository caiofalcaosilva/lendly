import { HeartHandshake, Timer, Award, Sparkles } from 'lucide-react'

/// Qualitative reputation badges, distinct from the numeric ReliabilityBadge —
/// each one recognizes a specific pattern of good behavior. Renders nothing
/// until a threshold is met, so badges stay a genuine signal rather than
/// participation trophies.
export default function ReputationBadges({
  reliabilityScore,
  reliabilityCount,
  onTimeRate,
  finishedLoansCount,
  averageRating,
  ratingCount,
  size = 'sm',
}: {
  reliabilityScore?: number | null
  reliabilityCount: number
  onTimeRate?: number | null
  finishedLoansCount: number
  averageRating: number
  ratingCount: number
  size?: 'sm' | 'md'
}) {
  const badges: { key: string; label: string; title: string; icon: typeof HeartHandshake; tone: string }[] = []

  // Makes newness visible instead of leaving it to be inferred from empty
  // stats — an empty rating is indistinguishable from "just never reviewed"
  // otherwise. Mutually exclusive with the badges below in practice, since
  // those all require a track record this account doesn't have yet.
  if (finishedLoansCount === 0 && ratingCount === 0) {
    badges.push({
      key: 'new',
      label: 'Novo por aqui',
      title: 'Ainda não completou nenhum empréstimo na plataforma',
      icon: Sparkles,
      tone: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800',
    })
  }

  if (reliabilityScore != null && reliabilityScore >= 85 && reliabilityCount >= 5) {
    badges.push({
      key: 'trusted',
      label: 'Vizinho confiável',
      title: `${Math.round(reliabilityScore)}% de confiabilidade em ${reliabilityCount} empréstimos`,
      icon: HeartHandshake,
      tone: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    })
  }

  if (onTimeRate === 100 && finishedLoansCount >= 3) {
    badges.push({
      key: 'punctual',
      label: 'Sempre pontual',
      title: `Devolveu no prazo em ${finishedLoansCount} de ${finishedLoansCount} empréstimos`,
      icon: Timer,
      tone: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    })
  }

  if (averageRating >= 4.5 && ratingCount >= 5) {
    badges.push({
      key: 'rated',
      label: 'Bem avaliado',
      title: `Nota média ${averageRating.toFixed(1)} em ${ratingCount} avaliações`,
      icon: Award,
      tone: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    })
  }

  if (badges.length === 0) return null

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map(({ key, label, title, icon: Icon, tone }) => (
        <span
          key={key}
          className={`inline-flex items-center rounded-full border font-medium flex-shrink-0 ${tone} ${sizeClasses}`}
          title={title}
        >
          <Icon className={iconSize} />
          {label}
        </span>
      ))}
    </div>
  )
}
