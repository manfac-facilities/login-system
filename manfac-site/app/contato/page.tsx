// manfac-site/app/contato/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import ContactForm from '@/components/ContactForm'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contato — Manfac Engenharia',
  description:
    'Agende uma conversa técnica com a Manfac: manutenção predial recorrente, obras e reformas corporativas ou avaliação técnica da sua operação.',
  alternates: {
    canonical: `${SITE_URL}/contato`,
  },
}

export default function ContatoPage() {
  return (
    <>
      <Header />
      <main>
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
