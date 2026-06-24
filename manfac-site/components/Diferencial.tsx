import BlueprintSection from './BlueprintSection'
import { DIFERENCIAIS } from '@/lib/content'

export default function Diferencial() {
  return (
    <BlueprintSection index="04" label="Diferencial">
      <div className="flex flex-wrap gap-3">
        {DIFERENCIAIS.map((d) => (
          <span
            key={d}
            className="rounded-full border border-[var(--border)] px-5 py-2 text-sm text-[var(--ink)]"
          >
            {d}
          </span>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-xl font-semibold leading-snug text-[var(--ink)]">
        &ldquo;Não escondemos problemas. Assumimos, tratamos e evoluímos continuamente.&rdquo;
      </p>
    </BlueprintSection>
  )
}
