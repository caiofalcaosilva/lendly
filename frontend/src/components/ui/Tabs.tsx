'use client'
import { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
}

interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
}

export default function Tabs({ items, activeId, onChange }: TabsProps) {
  return (
    <div className="border-b border-border mb-6 overflow-x-auto">
      <div role="tablist" className="flex gap-0 -mb-px w-max min-w-full">
        {items.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={activeId === id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeId === id
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
