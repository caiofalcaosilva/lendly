import { MetadataRoute } from 'next'

const PUBLIC_PATHS = ['', '/items', '/groups/discover', '/empresas', '/sobre', '/login', '/register']

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const now = new Date()

  return PUBLIC_PATHS.flatMap((path) => [
    { url: `${siteUrl}${path}`, lastModified: now },
    { url: `${siteUrl}/en${path}`, lastModified: now },
  ])
}
