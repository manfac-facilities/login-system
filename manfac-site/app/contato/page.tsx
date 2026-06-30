// manfac-site/app/contato/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Contato — Manfac Engenharia',
  description: 'Fale com a Manfac Engenharia sobre gestão e execução de obras, reformas e manutenção predial.',
}

export default function ContatoPage() {
  return (
    <>
      <Header />
      <main>
        <Contato />
      </main>
      <Footer />
    </>
  )
}
