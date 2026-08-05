import type { Metadata } from 'next'
import UserPublicClient from './UserPublicClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchUserForMetadata(id: string) {
  try {
    const res = await fetch(`${API_URL}/users/${id}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await fetchUserForMetadata(params.id)
  if (!user) {
    return { title: 'Usuário não encontrado | Lendly' }
  }

  const name = user.trade_name || user.name
  const location = [user.neighborhood, user.city].filter(Boolean).join(', ')
  const description = user.bio?.trim()
    || (location ? `${name} · ${location} · Perfil no Lendly` : `${name} · Perfil no Lendly`)

  return {
    title: `${name} | Lendly`,
    description,
    openGraph: {
      title: name,
      description,
      url: `/users/${params.id}`,
      siteName: 'Lendly',
      locale: 'pt_BR',
      type: 'profile',
      ...(user.avatar_url ? { images: [{ url: user.avatar_url }] } : {}),
    },
    twitter: {
      card: user.avatar_url ? 'summary_large_image' : 'summary',
      title: name,
      description,
      ...(user.avatar_url ? { images: [user.avatar_url] } : {}),
    },
  }
}

export default function UserPublicPage() {
  return <UserPublicClient />
}
