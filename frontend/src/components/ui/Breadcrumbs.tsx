import { Link } from '@/i18n/navigation'

export interface BreadcrumbItem {
  label: string
  href?: string
}

/// Last item is the current page — never a link, even if `href` is passed.
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-subtle flex-wrap mb-4">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-50">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-primary transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-ink font-medium' : ''} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
