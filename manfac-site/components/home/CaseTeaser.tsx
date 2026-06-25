import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import Reveal from '../Reveal'
import { RESULTADOS } from '@/lib/content'

export default function CaseTeaser() {
  return (
    <BlueprintSection index="04" label="Resultados">
      <Reveal>
        <h2 className="max-w-3xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
          Um dos maiores varejistas do setor farmacêutico do Brasil colocou a Manfac na gestão de
          400+ unidades no Rio de Janeiro.
        </h2>
      </Reveal>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {RESULTADOS.map((r, i) => (
          <Reveal key={r.label} delay={(i + 1) * 100}>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <p className="text-3xl font-bold text-[var(--orange)]">{r.value}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{r.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={(RESULTADOS.length + 1) * 100}>
        <Link
          href="/resultados"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
        >
          Ver o case completo →
        </Link>
      </Reveal>
    </BlueprintSection>
  )
}
