// manfac-site/app/servicos/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Servicos from '@/components/Servicos'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Serviços — Manfac Engenharia',
  description:
    'Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva, e sistemas de climatização (HVAC).',
}

export default function ServicosPage() {
  return (
    <>
      <Header />
      <main>
        <Servicos />
      </main>
      <Footer />
    </>
  )
}
