import Image from 'next/image'
import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { PILARES } from '@/lib/content'

export default function QuemSomos() {
  return (
    <>
      {/* Page hero */}
      <section className="relative isolate overflow-hidden border-b border-[var(--border)]">
        <div className="relative h-80 w-full md:h-[420px]">
          <Image
            src="/media/qs-hero.jpg"
            alt="Grande obra de engenharia Manfac"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-[var(--ink)]/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                Quem somos
              </span>
            </Reveal>
            <Reveal delay={130}>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl">
                Engenharia que vai
                <br />
                além da obra.
              </h1>
            </Reveal>
            <Reveal delay={260}>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
                Gestão integrada, execução técnica e visibilidade contínua para operações de grande escala.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Missão + Pilares */}
      <BlueprintSection index="01" label="Nossa missão">
        <div className="grid gap-14 md:grid-cols-2 md:items-start">
          <Reveal>
            <h2 className="text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
              Especialistas na gestão e execução de obras, reformas e manutenção predial para
              grandes operações.
            </h2>
            <p className="mt-5 text-[var(--body-text)]">
              A Manfac é uma empresa de engenharia especializada em manutenção predial, obras e
              reformas corporativas para grandes operações. Atuamos com equipe própria, gestão
              ativa e visibilidade em campo para empresas que precisam de previsibilidade, padrão
              técnico e resposta rápida em múltiplas unidades.
            </p>
            <p className="mt-4 text-[var(--body-text)]">
              Enquanto o mercado divide engenharia em contratos isolados, a Manfac entrega um modelo
              único: do diagnóstico à conclusão, com um time que conhece cada detalhe da sua
              demanda.
            </p>
            <p className="mt-4 text-[var(--body-text)]">
              Nosso compromisso é que cada cliente tenha mais controle, mais clareza e mais confiança
              na execução — com responsabilidade total do início ao fim.
            </p>
          </Reveal>

          <div className="space-y-5">
            {PILARES.map((pilar, i) => (
              <Reveal key={pilar.title} delay={i * 150}>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <div className="mb-4 h-1 w-8 rounded-full bg-[var(--orange)]" />
                  <h3 className="font-bold text-[var(--ink)]">{pilar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--body-text)]">
                    {pilar.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </BlueprintSection>
    </>
  )
}
