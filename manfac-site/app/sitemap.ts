import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const LAST_CONTENT_UPDATE = new Date('2026-06-17')

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: LAST_CONTENT_UPDATE,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
