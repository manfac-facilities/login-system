import Image from 'next/image'
import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import Reveal from '../Reveal'

export default function QuemSomosTeaser() {
  return (
    <BlueprintSection index="02" label="Como atuamos">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal delay={0}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
            <Image
              src="/media/equipe-stock.jpg"
              alt="Equipe de engenharia executando obra predial em campo"
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </Reveal>
        <div>
          <Reveal delay={150}>
            <h2 className="text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
              Toda a sua infraestrutura gerida por um único time técnico.
            </h2>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-4 text-[var(--body-text)]">
              Falhas e estouros de orçamento costumam acontecer quando obras, reformas e manutenção
              ficam com fornecedores diferentes — sem conexão entre pessoas, processos e informações
              em campo.
            </p>
            <p className="mt-3 text-[var(--body-text)]">
              A Manfac assume tudo com equipe própria: do diagnóstico à conclusão, com
              responsabilidade total e visibilidade em cada etapa.
            </p>
          </Reveal>
          <Reveal delay={380}>
            <Link
              href="/quem-somos"
              className="mt-6 inline-flex items-center gap-2 font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
            >
              Conheça a Abordagem Manfac →
            </Link>
          </Reveal>
        </div>
      </div>
    </BlueprintSection>
  )
}
