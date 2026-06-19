import Header from '@/components/Header'
import Hero from '@/components/Hero'
import QuemSomos from '@/components/QuemSomos'
import Problema from '@/components/Problema'
import Abordagem from '@/components/Abordagem'
import Servicos from '@/components/Servicos'
import Case from '@/components/Case'
import Diferencial from '@/components/Diferencial'
import Time from '@/components/Time'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <QuemSomos />
        <Problema />
        <Abordagem />
        <Servicos />
        <Case />
        <Diferencial />
        <Time />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
