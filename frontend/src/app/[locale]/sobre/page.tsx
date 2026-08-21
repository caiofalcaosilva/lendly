import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import AboutClient from './AboutClient'

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'About' })
  return {
    title: `${t('metaTitle')} | Lendly`,
    description: t('heroSubtitle'),
  }
}

export default function AboutPage() {
  return <AboutClient />
}
