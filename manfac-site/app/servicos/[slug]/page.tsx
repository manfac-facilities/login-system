import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ServicePage from '@/components/ServicePage'
import { SERVICOS_DATA, getServico } from '@/lib/servicos'

export function generateStaticParams() {
  return SERVICOS_DATA.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const servico = getServico(slug)
  if (!servico) return {}
  return {
    title: servico.metaTitle,
    description: servico.metaDescription,
    openGraph: { title: servico.metaTitle, description: servico.metaDescription },
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
