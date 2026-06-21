'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Leaf, Menu, X, LayoutDashboard, LogOut, Plus, UserCog, MailWarning } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      {isAuthenticated && user && !user.is_verified && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 text-xs">
          <MailWarning className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Verifique seu e-mail para ativar a conta.</span>
          <Link href="/profile" className="font-semibold underline hover:text-amber-900">
            Reenviar link
          </Link>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-green-600">
          <Leaf className="w-6 h-6" />
          Lendly
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/items"
            className={`text-sm font-medium transition-colors ${pathname === '/items' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Explorar itens
          </Link>

          {isAuthenticated ? (
            <>
              <Link href="/items/new">
                <Button size="sm" variant="secondary">
                  <Plus className="w-4 h-4" /> Anunciar item
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm" variant="ghost">
                  <LayoutDashboard className="w-4 h-4" />
                  {user?.name.split(' ')[0]}
                </Button>
              </Link>
              <Link href="/profile" title="Editar perfil">
                <Button size="sm" variant="ghost">
                  <UserCog className="w-4 h-4" />
                </Button>
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="outline" size="sm">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Criar conta</Button>
              </Link>
            </div>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <Link href="/items" className="block text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Explorar itens</Link>
          {isAuthenticated ? (
            <>
              <Link href="/items/new" className="block text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Anunciar item</Link>
              <Link href="/dashboard" className="block text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Painel</Link>
              <Link href="/profile" className="block text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Editar perfil</Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="block text-red-600 py-2">Sair</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-gray-700 py-2" onClick={() => setMobileOpen(false)}>Entrar</Link>
              <Link href="/register" className="block text-green-600 font-medium py-2" onClick={() => setMobileOpen(false)}>Criar conta</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
