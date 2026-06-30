import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import Counter from './Counter'
import { STATS } from '@/lib/content'

export default function Stats({ index = '00' }: { index?: string }) {
  return (
    <BlueprintSection index={index} label="Em números" tone="alt">
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] md:grid-cols-4 md:divide-y-0">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 120}>
            <div className="px-6 py-8 text-center">
              <p className="text-3xl font-bold text-[var(--orange)] md:text-4xl">
                <Counter value={s.value} />
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </BlueprintSection>
  )
}
