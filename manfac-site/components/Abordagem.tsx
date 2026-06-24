import BlueprintSection from './BlueprintSection'
import { PASSOS, BANNERS } from '@/lib/content'

export default function Abordagem() {
  return (
    <BlueprintSection index="03" label="Nossa abordagem" tone="alt">
      <h2 className="max-w-3xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        Estruturamos a operação como um sistema integrado, conectando pessoas, processos e
        informações. Executamos com excelência técnica e gerenciamos com inteligência,
        transparência e foco em resultado.
      </h2>

      <h3 className="mt-14 text-lg font-semibold text-[var(--ink)]">Como atuamos</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-5">
        {PASSOS.map((passo) => (
          <div key={passo.n} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
            <span className="font-mono text-2xl font-bold text-[var(--orange)]">{passo.n}</span>
            <p className="mt-3 text-sm text-[var(--muted)]">{passo.title}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3 text-center">
        {BANNERS.map((b) => (
          <span
            key={b}
            className="rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-2 text-sm text-[var(--muted)]"
          >
            {b}
          </span>
        ))}
      </div>
    </BlueprintSection>
  )
}
