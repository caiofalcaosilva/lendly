'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Leaf, ArrowRight, ShieldCheck, Users, Wrench,
  Bike, BookOpen, Package, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'

const HOW_IT_WORKS = [
  { step: '1', title: 'Cadastre seu item', desc: 'Foto, descrição e preço. Em minutos disponível para a vizinhança.' },
  { step: '2', title: 'Receba solicitações', desc: 'Vizinhos encontram seu item e enviam pedido de empréstimo ou aluguel.' },
  { step: '3', title: 'Compartilhe e avalie', desc: 'Combine pessoalmente, empreste e avaliem-se mutuamente.' },
]

const FEATURES = [
  { icon: ShieldCheck, title: 'Seguro', desc: 'Avaliações mútuas e histórico criam confiança na comunidade.' },
  { icon: Users, title: 'Comunitário', desc: 'Fortaleça laços com vizinhos e crie uma rede de colaboração real.' },
  { icon: Leaf, title: 'Sustentável', desc: 'Reduza o consumo e o desperdício na sua região.' },
]

const CATEGORIES = [
  { icon: Wrench, label: 'Ferramentas', value: 'tools' },
  { icon: Bike, label: 'Esportes', value: 'sports' },
  { icon: BookOpen, label: 'Livros', value: 'books' },
  { icon: Package, label: 'E muito mais', value: '' },
]

export default function LandingPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAuthenticated, router])

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <Spinner className="w-8 h-8 text-green-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" />
            Comunidade sustentável
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
            Empreste, alugue e{' '}
            <span className="text-green-600 dark:text-green-400">fortaleça sua vizinhança</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Lendly conecta vizinhos para compartilhar objetos. Menos compras
            desnecessárias, mais conexão entre pessoas e mais dinheiro no bolso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Começar agora <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/items"
              className="inline-flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-8 py-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              Explorar itens
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-12">O que você pode encontrar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CATEGORIES.map(({ icon: Icon, label, value }) => (
              <Link
                key={label}
                href={value ? `/items?category=${value}` : '/items'}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow group"
              >
                <Icon className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-green-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Por que usar o Lendly?
              </h2>
              <ul className="space-y-4">
                {[
                  'Economize dinheiro evitando compras desnecessárias',
                  'Ganhe renda extra com itens parados em casa',
                  'Conheça seus vizinhos e fortaleça a comunidade',
                  'Reduza o impacto ambiental do consumo excessivo',
                ].map((text) => (
                  <li key={text} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-sm">
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 dark:text-green-400 mb-2">100%</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium mb-6">gratuito para começar</div>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-700 transition-colors w-full"
                >
                  Criar conta grátis <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Sem cartão de crédito necessário</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
