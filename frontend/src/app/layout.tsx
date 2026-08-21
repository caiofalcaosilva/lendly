// Deliberately minimal: [locale]/layout.tsx owns <html>/<body> for every
// real route (rewritten through next-intl). This passthrough exists only
// so Next's automatic not-found/error boundary resolution has a root
// layout to anchor to — without it, unmatched routes 500 instead of
// falling back to [locale]/not-found.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
