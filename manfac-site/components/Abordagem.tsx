import Image from 'next/image'
import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { PASSOS, BANNERS } from '@/lib/content'

export default function Abordagem() {
  return (
    <BlueprintSection index="02" label="Nossa abordagem" tone="alt">
      <div className="grid gap-14 md:grid-cols-2 md:items-center">
        {/* Image */}
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/media/qs-abordagem.jpg"
              alt="Equipe Manfac planejando execução de obra"
              fill
              className="object-cover object-[center_60%]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </Reveal>

        {/* Steps */}
        <div>
          <Reveal delay={80}>
            <h2 className="text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
              Do diagnóstico à entrega —<br />sem buracos no meio do caminho.
            </h2>
            <p className="mt-4 text-[var(--body-text)]">
              Cada etapa tem dono, prazo e responsável. Você acompanha tudo do início ao fim,
              com controle de cronograma, custos e comunicação recorrente.
            </p>
          </Reveal>

          <div className="mt-8 space-y-0">
            {PASSOS.map((passo, i) => (
              <Reveal key={passo.n} delay={160 + i * 70}>
                <div className="flex gap-5 border-b border-[var(--border)] py-4 last:border-0">
                  <span className="shrink-0 font-mono text-2xl font-bold leading-none text-[var(--orange)]">
                    {passo.n}
                  </span>
                  <p className="pt-0.5 font-semibold text-[var(--ink)]">{passo.title}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Banners */}
      <Reveal delay={500}>
        <div className="mt-16 flex flex-wrap justify-center gap-4">
          {BANNERS.map((b) => (
            <span
              key={b}
              className="rounded-full border border-[var(--orange)] px-7 py-2.5 font-semibold text-[var(--orange)]"
            >
              {b}
            </span>
          ))}
        </div>
      </Reveal>
    </BlueprintSection>
  )
}
