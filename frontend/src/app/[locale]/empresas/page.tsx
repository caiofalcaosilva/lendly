import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import EmpresasClient from './EmpresasClient'

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Empresas' })
  return {
    title: `${t('title')} | Lendly`,
    description: t('subtitle'),
  }
}

export default function BusinessesPage() {
  return <EmpresasClient />
}
