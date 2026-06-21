import { Leaf } from 'lucide-react'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-green-600 font-semibold">
          <Leaf className="w-5 h-5" />
          Lendly
        </Link>
        <p className="text-sm text-gray-500 text-center">
          Compartilhe com seus vizinhos. Reduza o consumo. Fortaleça a comunidade.
        </p>
        <div className="flex gap-4 text-sm text-gray-500">
          <Link href="/items" className="hover:text-gray-800 transition-colors">Explorar</Link>
          <Link href="/register" className="hover:text-gray-800 transition-colors">Criar conta</Link>
        </div>
      </div>
    </footer>
  )
}
