import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { SERVICOS_DATA } from '@/lib/servicos'

const LAST_CONTENT_UPDATE = new Date('2026-07-15')

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/quem-somos',
    '/servicos',
    ...SERVICOS_DATA.map((s) => `/servicos/${s.slug}`),
    '/resultados',
    '/contato',
  ]

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }))
}
