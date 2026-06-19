import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SITE_URL } from '@/lib/site'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = SITE_URL

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Manfac Engenharia — Obras, Reformas e Manutenção Predial para Grandes Operações',
  description:
    'A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações, com visibilidade e controle em tempo real.',
  keywords: [
    'manutenção predial',
    'facilities management',
    'obras corporativas',
    'reformas comerciais',
    'manutenção predial preventiva',
    'climatização HVAC',
    'engenharia predial Rio de Janeiro',
  ],
  openGraph: {
    title: 'Manfac Engenharia — Obras, Reformas e Manutenção Predial para Grandes Operações',
    description:
      'Gestão e execução de obras, reformas e manutenção predial para grandes operações, com visibilidade e controle em tempo real.',
    url: siteUrl,
    siteName: 'Manfac Engenharia',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/logo.png`,
        width: 835,
        height: 228,
        alt: 'Manfac Engenharia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manfac Engenharia',
    description:
      'Gestão e execução de obras, reformas e manutenção predial para grandes operações.',
    images: [`${siteUrl}/logo.png`],
  },
  alternates: {
    canonical: siteUrl,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'GeneralContractor',
  name: 'Manfac Engenharia',
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    'Empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações.',
  areaServed: 'BR',
  address: {
    '@type': 'PostalAddress',
    addressRegion: 'RJ',
    addressCountry: 'BR',
  },
  email: 'contato@manfac.com.br',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
