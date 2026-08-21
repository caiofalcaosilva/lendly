import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
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

export async function generateMetadata({
  params,
}: {
  params: { id: string; locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Users.Id' })
  const user = await fetchUserForMetadata(params.id)
  if (!user) {
    return { title: t('metaNotFoundTitle') }
  }

  const name = user.trade_name || user.name
  const location = [user.neighborhood, user.city].filter(Boolean).join(', ')
  const description = user.bio?.trim()
    || (location ? t('metaDescriptionWithLocation', { name, location }) : t('metaDescriptionNoLocation', { name }))
  // Next doesn't deep-merge `openGraph` across segments — a route that
  // returns its own openGraph object replaces the root layout's entirely,
  // fallback image included. Falling back to it explicitly here instead.
  const ogImage = user.avatar_url || '/og-image.jpg'

  return {
    title: `${name} | Lendly`,
    description,
    openGraph: {
      title: name,
      description,
      url: `/users/${params.id}`,
      siteName: 'Lendly',
      locale: params.locale === 'en' ? 'en_US' : 'pt_BR',
      type: 'profile',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [ogImage],
    },
  }
}

export default function UserPublicPage() {
  return <UserPublicClient />
}
