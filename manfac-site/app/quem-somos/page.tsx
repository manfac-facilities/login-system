// manfac-site/app/quem-somos/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import QuemSomos from '@/components/QuemSomos'
import Abordagem from '@/components/Abordagem'
import Diferencial from '@/components/Diferencial'
import Time from '@/components/Time'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Quem somos — Manfac Engenharia',
  description:
    'A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações.',
}

export default function QuemSomosPage() {
  return (
    <>
      <Header />
      <main>
        <QuemSomos />
        <Abordagem />
        <Diferencial />
        <Time />
      </main>
      <Footer />
    </>
  )
}
