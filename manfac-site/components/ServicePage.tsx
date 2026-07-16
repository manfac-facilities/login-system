import Image from 'next/image'
import Reveal from './Reveal'
import Contato from './Contato'
import type { ServicoData } from '@/lib/servicos'

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/10">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function ServicePage({ servico }: { servico: ServicoData }) {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-[var(--border)] text-white">
        <Image
          src={servico.foto}
          alt={servico.fotoAlt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[var(--ink)]/78" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <Reveal>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Serviços · {servico.nome}
            </p>
            <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              {servico.headline}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">{servico.sub}</p>
            <a
              href="/contato"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--orange-hover)]"
            >
              Solicitar proposta técnica
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      {/* Para quem é / dores / escopo */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Para quem é</p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)]">{servico.paraQuem}</h2>
              <p className="mt-6 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Dores que resolve</p>
              <p className="mt-3 text-[var(--body-text)]">{servico.dores}</p>
            </Reveal>
            <Reveal delay={140}>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Escopo</p>
              <ul className="mt-4 space-y-3">
                {servico.escopo.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check />
                    <span className="text-sm text-[var(--body-text)]">{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Como executamos + indicadores */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Como executamos</p>
              <p className="mt-4 text-lg leading-relaxed text-[var(--body-text)]">{servico.comoExecutamos}</p>
              <div className="mt-8 flex flex-wrap gap-8">
                {servico.indicadores.map((ind) => (
                  <div key={ind.label}>
                    <p className="text-2xl font-bold text-[var(--orange)]">{ind.value}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{ind.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src={servico.foto}
                  alt={servico.fotoAlt}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contrato vs. spot */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Como contratar
            </p>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl p-7" style={{ backgroundColor: 'var(--ink)' }}>
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Contrato recorrente</p>
                <p className="mt-3 text-white/85">{servico.recorrente}</p>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="h-full rounded-2xl border border-[var(--border)] p-7">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Demanda spot</p>
                <p className="mt-3 text-[var(--body-text)]">{servico.spot}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <Contato />
    </>
  )
}
