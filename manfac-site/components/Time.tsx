import Image from 'next/image'
import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { IMPACTO } from '@/lib/content'

export default function Time() {
  return (
    <BlueprintSection index="04" label="Nossa cultura" tone="alt">
      <div className="grid gap-14 md:grid-cols-2 md:items-center">
        {/* Text side */}
        <div>
          <Reveal>
            <h2 className="text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
              Uma equipe que trata sua operação como se fosse dela.
            </h2>
            <p className="mt-4 text-[var(--body-text)]">
              A Manfac é formada por profissionais que entendem que resultado não é discurso —
              é consistência ao longo do tempo. Proximidade com o cliente e comunicação direta
              em cada etapa da operação.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8">
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                Impacto que geramos
              </p>
              <ul className="space-y-3">
                {IMPACTO.map((item, i) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/10">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="font-medium text-[var(--ink)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Image side */}
        <Reveal delay={120}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/media/qs-time.jpg"
              alt="Equipe Manfac em campo"
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Overlay card */}
            <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-[var(--ink)]/90 p-4 backdrop-blur-sm">
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--orange)]">
                Manfac em campo
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                Presença ativa. Comunicação direta. Entrega garantida.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </BlueprintSection>
  )
}
