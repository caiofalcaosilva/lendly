'use client'
import { Leaf } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function Footer() {
  const { isAuthenticated } = useAuth()

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
          <Leaf className="w-5 h-5" />
          Lendly
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Compartilhe com seus vizinhos. Reduza o consumo. Fortaleça a comunidade.
        </p>
        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/items" className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Explorar</Link>
          {isAuthenticated ? (
            <Link href="/dashboard" className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Painel</Link>
          ) : (
            <Link href="/register" className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Criar conta</Link>
          )}
        </div>
      </div>
    </footer>
  )
}
