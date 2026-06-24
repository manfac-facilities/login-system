import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Stats from '@/components/Stats'
import Problema from '@/components/Problema'
import QuemSomosTeaser from '@/components/home/QuemSomosTeaser'
import ServicosTeaser from '@/components/home/ServicosTeaser'
import CaseTeaser from '@/components/home/CaseTeaser'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Problema />
        <QuemSomosTeaser />
        <ServicosTeaser />
        <CaseTeaser />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
