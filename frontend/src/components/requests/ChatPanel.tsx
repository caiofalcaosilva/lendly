'use client'
import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Message } from '@/types'
import { messagesService } from '@/services/messages'
import { getAccessToken } from '@/lib/tokenStorage'

function wsUrl(requestId: string, token: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const base = apiUrl.replace(/^http/, 'ws')
  return `${base}/requests/${requestId}/ws?token=${encodeURIComponent(token)}`
}

export default function ChatPanel({
  requestId,
  currentUserId,
}: {
  requestId: string
  currentUserId: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  const merge = (incoming: Message[]) => {
    // Dedupe against seenIds *before* touching state — mutating a ref inside
    // a setState updater is impure, and React 18 Strict Mode double-invokes
    // updaters in dev, which corrupts the result if the updater has side effects.
    const additions = incoming.filter((m) => !seenIds.current.has(m.id))
    if (!additions.length) return
    additions.forEach((m) => seenIds.current.add(m.id))
    setMessages((prev) =>
      [...prev, ...additions].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    )
  }

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    messagesService
      .list(requestId)
      .then((initial) => {
        if (cancelled) return
        merge(initial)
      })
      .catch(() => setError('Não foi possível carregar as mensagens'))
      .finally(() => setLoading(false))

    const connect = () => {
      const token = getAccessToken()
      if (!token || cancelled) return
      socket = new WebSocket(wsUrl(requestId, token))
      socket.onmessage = (event) => merge([JSON.parse(event.data)])
      socket.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000)
      }
    }
    connect()

    return () => {
      cancelled = true
      socket?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')
    try {
      const sent = await messagesService.send(requestId, trimmed)
      merge([sent])
      setText('')
    } catch {
      setError('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[480px]">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversa</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando mensagens...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma mensagem ainda. Diga oi!</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && <span className="text-xs text-gray-400 dark:text-gray-500 mb-0.5 px-1">{m.sender_name}</span>}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words ${
                    mine ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-gray-100 dark:border-gray-700">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-3 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 hover:bg-green-700 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
