import BlueprintSection from './BlueprintSection'
import { IMPACTO } from '@/lib/content'

export default function Time() {
  return (
    <BlueprintSection index="05" label="Nosso time" tone="alt">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <p className="text-xl font-semibold leading-snug text-[var(--ink)]">
            Senso de urgência, responsabilidade e foco em resultado.
          </p>
          <p className="mt-4 text-[var(--muted)]">
            Proximidade com o cliente e comunicação direta em cada etapa da operação.
          </p>
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wide text-[var(--orange)]">
            Impacto desejado
          </h3>
          <ul className="mt-4 space-y-2">
            {IMPACTO.map((i) => (
              <li key={i} className="flex items-center gap-3 text-[var(--muted)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--orange)]" />
                {i}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Resultado não é discurso — é consistência ao longo do tempo.
          </p>
        </div>
      </div>
    </BlueprintSection>
  )
}
