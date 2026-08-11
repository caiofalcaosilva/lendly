'use client'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { AdminUserSummary } from '@/types'
import { adminUsersService } from '@/services/adminUsers'
import { useEscapeKey } from '@/lib/useEscapeKey'

interface Props {
  label: string
  placeholder: string
  selected: AdminUserSummary | null
  onChange: (user: AdminUserSummary | null) => void
}

// A search-as-you-type autocomplete over GET /admin/users?search= — reused
// for both the "recipient" and "actor" filters on the admin activity search,
// since both need the same "type a name/email, pick the user, get an id".
export default function UserPicker({ label, placeholder, selected, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserSummary[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      adminUsersService
        .list({ search: query, limit: 8 })
        .then((data) => {
          setResults(data)
          setOpen(true)
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEscapeKey(open, () => setOpen(false))

  if (selected) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink-muted">{label}</label>
        <div className="flex items-center justify-between gap-2 border border-border rounded-control px-3 py-2 bg-surface-2">
          <div className="min-w-0">
            <p className="text-sm text-ink truncate">{selected.name}</p>
            <p className="text-xs text-ink-subtle truncate">{selected.email}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={label}
            className="p-1 rounded-control text-ink-subtle hover:text-danger hover:bg-danger-subtle transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-1" ref={ref}>
      <label htmlFor={`picker-${label}`} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id={`picker-${label}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-border rounded-control pl-8 pr-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>
      {open && (loading || results.length > 0) && (
        <div className="absolute top-full mt-1 w-full bg-surface border border-border rounded-panel shadow-overlay z-10 max-h-56 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange(u)
                setQuery('')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            >
              <p className="text-ink truncate">{u.name}</p>
              <p className="text-xs text-ink-subtle truncate">{u.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
