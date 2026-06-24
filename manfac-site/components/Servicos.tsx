import BlueprintSection from './BlueprintSection'
import { SERVICOS } from '@/lib/content'

export default function Servicos() {
  return (
    <BlueprintSection index="00" label="Serviços">
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICOS.map((servico) => (
          <div key={servico.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-semibold text-[var(--ink)]">{servico.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{servico.description}</p>
          </div>
        ))}
      </div>
    </BlueprintSection>
  )
}
