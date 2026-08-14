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
  // No overflow-x scroll wrapper: with this component's actual (short)
  // labels it's never needed, and pairing it with the -mb-px border trick
  // below made browsers compute a 1px vertical overflow, which — per the CSS
  // overflow spec, where a non-"visible" x-axis forces the y-axis's computed
  // value to "auto" too — showed a spurious vertical scrollbar. flex-wrap is
  // enough of a safety net for pathologically narrow viewports.
  return (
    <div className="border-b border-border mb-6">
      <div role="tablist" className="flex flex-wrap gap-0 -mb-px">
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
