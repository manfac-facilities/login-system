import Image from 'next/image'
import Link from 'next/link'
import Reveal from './Reveal'
import { SERVICOS_DATA } from '@/lib/servicos'

const ANCHOR_IDS: Record<string, string> = {
  'obras-e-reformas': 'obras-reformas',
  'novas-construcoes': 'novas-construcoes',
  'manutencao-predial': 'manutencao-predial',
  hvac: 'hvac',
}

export default function Servicos() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[var(--border)] text-white">
        <Image
          src="/media/servicos-hero.jpg"
          alt="Skyline urbano com guindastes de construção"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[var(--ink)]/75" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center md:py-40">
          <Reveal>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Serviços
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Tudo que sua infraestrutura precisa.
              <br />
              Uma equipe. Um único ponto de responsabilidade.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
              Obras, reformas, novas construções, manutenção predial e climatização — com equipe
              técnica própria e responsabilidade total do início ao fim.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {SERVICOS_DATA.map((s) => (
                <a
                  key={s.slug}
                  href={`/servicos/${s.slug}`}
                  className="rounded-full border border-white/35 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:border-[var(--orange)] hover:text-[var(--orange)]"
                >
                  {s.nome}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Service summary cards ────────────────────────────────────── */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-6 md:grid-cols-2">
            {SERVICOS_DATA.map((servico) => (
              <div
                key={servico.slug}
                id={ANCHOR_IDS[servico.slug]}
                className="scroll-mt-20 rounded-2xl border border-[var(--border)] p-8"
              >
                <Reveal>
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                    {servico.nome}
                  </p>
                  <p className="mt-4 leading-relaxed text-[var(--body-text)]">{servico.sub}</p>
                  <Link
                    href={`/servicos/${servico.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--orange)] transition-colors hover:text-[var(--orange-hover)]"
                  >
                    Conhecer o serviço
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
