import Image from 'next/image'

const SIZES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-20 h-20 text-3xl',
} as const

export default function Avatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const sizeClasses = SIZES[size]

  if (avatarUrl) {
    return (
      <div className={`relative ${sizeClasses} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <Image src={avatarUrl} alt={name} fill unoptimized className="object-cover" />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className="font-bold text-green-600 dark:text-green-400">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
