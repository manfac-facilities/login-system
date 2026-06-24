import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const LAST_CONTENT_UPDATE = new Date('2026-06-23')

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/quem-somos', '/servicos', '/resultados', '/contato']

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }))
}
