import type { Metadata } from 'next'
import Header from '@/components/Header'
import Servicos from '@/components/Servicos'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Serviços — Manfac Engenharia',
  description:
    'Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva e sistemas de climatização (HVAC) — tudo com equipe técnica própria.',
  alternates: {
    canonical: `${SITE_URL}/servicos`,
  },
}

export default function ServicosPage() {
  return (
    <>
      <Header />
      <main>
        <Servicos />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
