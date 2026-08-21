import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import DiscoverClient from './DiscoverClient'

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Groups.Discover' })
  return {
    title: `${t('title')} | Lendly`,
    description: t('subtitle'),
  }
}

export default function DiscoverGroupsPage() {
  return <DiscoverClient />
}
