'use client'
import { useEffect, useRef } from 'react'

// Blank until a site key exists (see NEXT_PUBLIC_TURNSTILE_SITE_KEY in
// .env) — same "inert until configured" pattern as every other external
// integration in this codebase. Nothing renders and no script loads
// without it, matching the backend gateway skipping verification the
// same way when TURNSTILE_SECRET_KEY is blank.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
        },
      ) => string
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      if (window.turnstile) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.onload = () => resolve()
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      window.turnstile.render(containerRef.current, { sitekey: SITE_KEY, callback: onToken })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- render once; onToken identity churn shouldn't re-mount the widget
  }, [])

  if (!SITE_KEY) return null

  return <div ref={containerRef} />
}
