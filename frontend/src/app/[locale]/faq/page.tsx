import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import FaqClient from './FaqClient'

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Faq' })
  return {
    title: `${t('metaTitle')} | Lendly`,
    description: t('metaDescription'),
  }
}

export default function FaqPage() {
  return <FaqClient />
}
