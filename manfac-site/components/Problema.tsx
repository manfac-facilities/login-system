import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { PROBLEMAS } from '@/lib/content'

export default function Problema() {
  return (
    <BlueprintSection index="01" label="O problema" tone="alt">
      <Reveal>
        <h2 className="max-w-2xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
          Sem gestão estruturada, obras e manutenção predial geram mais custo do que deveriam.
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PROBLEMAS.map((problema, i) => (
          <Reveal key={problema} delay={(i + 1) * 80}>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--orange)]" />
              <p className="text-[var(--muted)]">{problema}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={400}>
        <p className="mt-8 text-[var(--muted)]">
          Com o tempo, isso gera perda de eficiência, aumento de custos e desgaste com as
          unidades operacionais.
        </p>
      </Reveal>
    </BlueprintSection>
  )
}
