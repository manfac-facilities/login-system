import Image from 'next/image'
import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import Reveal from '../Reveal'

export default function QuemSomosTeaser() {
  return (
    <BlueprintSection index="02" label="Quem somos">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <Reveal delay={0}>
          <div className="overflow-hidden rounded-lg">
            <Image
              src="/media/equipe-1.jpg"
              alt="Equipe Manfac realizando manutenção predial em campo"
              width={1600}
              height={900}
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>
        <div>
          <Reveal delay={150}>
            <h2 className="text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
              A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
              reformas e manutenção predial para grandes operações.
            </h2>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-4 text-[var(--muted)]">
              Atuamos lado a lado com a operação do cliente, do planejamento à entrega, com equipe
              própria em campo e visibilidade do início ao fim de cada projeto.
            </p>
          </Reveal>
          <Reveal delay={380}>
            <Link
              href="/quem-somos"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
            >
              Saiba mais sobre a Manfac →
            </Link>
          </Reveal>
        </div>
      </div>
    </BlueprintSection>
  )
}
