/// Shared shell for admin listing tables — wrapper, head row, body row.
/// Deliberately doesn't own column definitions or skeleton-row shape: each
/// page's columns differ enough (and each skeleton row is shaped to match
/// its own real content) that a generic `columns` prop would either force
/// an awkward common shape or just move the duplication instead of removing
/// it. What actually repeated verbatim across admin pages was the
/// wrapper/head/row markup — that's what this collapses.
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-panel border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">{children}</table>
      </div>
    </div>
  )
}

export function TableHeadRow({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border text-left text-xs text-ink-subtle uppercase tracking-wide">
        {children}
      </tr>
    </thead>
  )
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border last:border-0">{children}</tr>
}
