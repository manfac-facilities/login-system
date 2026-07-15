import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Stats from '@/components/Stats'
import Dores from '@/components/home/Dores'
import ComoFunciona from '@/components/home/ComoFunciona'
import ServicosTeaser from '@/components/home/ServicosTeaser'
import RecorrenteSpot from '@/components/home/RecorrenteSpot'
import CaseTeaser from '@/components/home/CaseTeaser'
import Diferenciais from '@/components/home/Diferenciais'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Dores />
        <ComoFunciona />
        <ServicosTeaser />
        <section className="border-b border-[var(--border)] bg-[var(--surface)]">
          <RecorrenteSpot />
        </section>
        <CaseTeaser />
        <Diferenciais />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
