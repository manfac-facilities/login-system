// manfac-site/app/contato/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import ContactForm from '@/components/ContactForm'
import ContatoInfo from '@/components/ContatoInfo'
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
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[1.6fr_1fr] md:items-start md:gap-10">
          <ContactForm />
          <ContatoInfo />
        </div>
        {/*
          O bloco do mapa sai da página enquanto o endereço da Manfac não vier —
          decisão do João em 26/08. Reservar espaço para algo que não existe é
          pior que não ter a seção: o visitante lê "endereço a confirmar" e
          conclui que a empresa não tem endereço.

          `components/MapaPlaceholder.tsx` continua no repositório de propósito.
          Quando o endereço chegar, ele volta aqui e o texto provisório dá lugar
          ao mapa de verdade.
        */}
      </main>
      <Footer />
    </>
  )
}
