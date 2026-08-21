// Root-level fallback: next-intl's rewrite means most 404s resolve inside
// [locale]/not-found.tsx (which has the full layout/chrome), but a path
// that doesn't even resolve to a locale segment lands here instead — no
// parent layout to inherit from (app/layout.tsx is a bare passthrough),
// so this renders its own minimal shell.
export default function RootNotFound() {
  return (
    <html lang="pt-BR">
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Página não encontrada</h1>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          O link pode estar quebrado, ou a página pode ter sido movida ou removida.
        </p>
        <a href="/" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
          Voltar ao início
        </a>
      </body>
    </html>
  )
}
