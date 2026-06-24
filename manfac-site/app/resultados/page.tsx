// manfac-site/app/resultados/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Case from '@/components/Case'
import Stats from '@/components/Stats'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Resultados — Manfac Engenharia',
  description:
    'Como a Manfac estruturou a gestão de 400+ unidades no Rio de Janeiro para um dos maiores varejistas farmacêuticos do Brasil.',
}

export default function ResultadosPage() {
  return (
    <>
      <Header />
      <main>
        <Case />
        <Stats index="01" />
      </main>
      <Footer />
    </>
  )
}
