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
      {/*
        O header agora é fixed e saiu do fluxo. As outras páginas começam com
        hero de imagem full-bleed, onde a pílula de vidro sobreposta é o efeito
        desejado. Esta começa com conteúdo claro, então precisa do respiro.
      */}
      <main className="pt-20">
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
