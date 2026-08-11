import { LucideIcon } from 'lucide-react'
import Button from './Button'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-ink-subtle" />
      </div>
      <h2 className="text-ink font-medium mb-1">{title}</h2>
      {description && <p className="text-ink-muted text-sm mb-4 max-w-xs">{description}</p>}
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
