import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ServicePage from '@/components/ServicePage'
import { SERVICOS_DATA, getServico } from '@/lib/servicos'
import { SITE_URL } from '@/lib/site'

export function generateStaticParams() {
  return SERVICOS_DATA.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const servico = getServico(slug)
  if (!servico) return {}
  const url = `${SITE_URL}/servicos/${slug}`
  return {
    title: servico.metaTitle,
    description: servico.metaDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: servico.metaTitle,
      description: servico.metaDescription,
      url,
      siteName: 'Manfac Engenharia',
      locale: 'pt_BR',
      type: 'website',
      images: [{ url: `${SITE_URL}${servico.foto}`, alt: servico.fotoAlt }],
    },
  }
}

export default async function ServicoRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const servico = getServico(slug)
  if (!servico) notFound()
  return (
    <>
      <Header />
      <main>
        <ServicePage servico={servico} />
      </main>
      <Footer />
    </>
  )
}
