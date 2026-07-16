import Image from 'next/image'
import Link from 'next/link'
import Reveal from '../Reveal'

const METRICAS = [
  {
    value: '+1.000',
    label: 'ordens de serviço por mês',
    Icon: () => (
      <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
        <rect x="6" y="4" width="20" height="24" rx="2" stroke="#f85e0b" strokeWidth="1.8" />
        <line x1="10" y1="11" x2="22" y2="11" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="21" x2="17" y2="21" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: '100%',
    label: 'das demandas concluídas mensalmente',
    Icon: () => (
      <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
        <circle cx="16" cy="16" r="11" stroke="#f85e0b" strokeWidth="1.8" />
        <path d="M10 16 l4 4 l8 -8" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: '400+',
    label: 'unidades sob gestão da Manfac no RJ',
    Icon: () => (
      <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
        <rect x="5" y="14" width="22" height="14" rx="1.5" stroke="#f85e0b" strokeWidth="1.8" />
        <rect x="11" y="8" width="10" height="10" rx="1.5" stroke="#f85e0b" strokeWidth="1.8" />
        <line x1="16" y1="4" x2="16" y2="8" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="13" y="20" width="6" height="8" rx="1" stroke="#f85e0b" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    value: '+R$800 mil',
    label: 'em obras e reformas por mês',
    Icon: () => (
      <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
        <polyline points="4,24 10,16 16,19 24,8 28,12" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <polyline points="24,8 28,8 28,12" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
]

export default function CaseTeaser() {
  return (
    <section className="bg-[#0b1e30]">
      <div className="mx-auto max-w-6xl px-6 py-20">

        {/* Header: título + foto */}
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Reveal delay={0}>
              <span className="inline-block rounded-full border border-[var(--orange)]/50 px-4 py-1.5 font-mono text-xs tracking-widest text-[var(--orange)]">
                CASE DE SUCESSO
              </span>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="mt-6 text-3xl font-bold leading-tight text-[var(--orange)] md:text-4xl">
                400+ unidades de um dos maiores varejistas farmacêuticos do Brasil, sob gestão Manfac.
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-4 text-white/70">
                Como a Manfac reestruturou a engenharia de manutenção de mais de{' '}
                <strong className="text-white">400 unidades</strong>{' '}de um dos maiores varejistas
                farmacêuticos do Brasil — R$&nbsp;16&nbsp;bi/ano,{' '}
                <strong className="text-white">1.600+ lojas</strong>{' '}no país.
              </p>
            </Reveal>
            <Reveal delay={340}>
              <p className="mt-3 text-white/60 text-sm">
                Uma operação fragmentada transformada em referência: +1.000 OS/mês com 100% das
                demandas concluídas mensalmente.
              </p>
            </Reveal>
          </div>
          <Reveal delay={160}>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image
                src="/media/equipe-1.jpg"
                alt="Equipe Manfac em operação"
                fill
                className="object-cover object-[center_60%] brightness-90"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </Reveal>
        </div>

        {/* Métricas */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {METRICAS.map((m, i) => (
            <Reveal key={m.label} delay={i * 90}>
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
                <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center">
                  <m.Icon />
                </div>
                <p className="text-3xl font-bold text-[var(--orange)]">{m.value}</p>
                <p className="mt-2 text-sm text-white/55">{m.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA */}
        <Reveal delay={METRICAS.length * 90}>
          <div className="mt-10 text-center">
            <Link
              href="/resultados"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-orange-400"
            >
              Ver como estruturamos essa operação →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
