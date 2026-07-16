import Reveal from './Reveal'
import Counter from './Counter'
import { STATS } from '@/lib/content'

export default function Stats() {
  return (
    <section aria-label="Manfac em números" style={{ backgroundColor: 'var(--ink)' }}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.09] md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 120}>
              <div
                className="flex h-full flex-col items-center justify-center px-4 py-8 text-center"
                style={{ backgroundColor: 'var(--ink)' }}
              >
                <p className="text-3xl font-extrabold text-[var(--orange)] md:text-4xl">
                  <Counter value={s.value} />
                </p>
                <p className="mt-2 text-sm leading-snug text-white/65">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
