import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { STATS } from '@/lib/content'

export default function Stats({ index = '00' }: { index?: string }) {
  return (
    <BlueprintSection index={index} label="Em números" tone="alt">
      <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 100}>
            <p className="text-2xl font-bold text-[var(--orange)] md:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)] md:text-sm">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </BlueprintSection>
  )
}
