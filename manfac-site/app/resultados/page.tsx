import type { Metadata } from 'next'
import Header from '@/components/Header'
import Resultados from '@/components/Resultados'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Resultados — Manfac Engenharia',
  description:
    'Como a Manfac estruturou a gestão de 400+ unidades no Rio de Janeiro para um dos maiores varejistas farmacêuticos do Brasil — transformando 7 anos de operação fragmentada em referência de excelência.',
}

export default function ResultadosPage() {
  return (
    <>
      <Header />
      <main>
        <Resultados />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
