import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import { SERVICOS } from '@/lib/content'

export default function ServicosTeaser() {
  return (
    <BlueprintSection index="03" label="Serviços" tone="alt">
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICOS.map((servico) => (
          <div key={servico.title} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
            <h3 className="font-semibold text-[var(--ink)]">{servico.title}</h3>
          </div>
        ))}
      </div>
      <Link
        href="/servicos"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
      >
        Ver todos os serviços →
      </Link>
    </BlueprintSection>
  )
}
