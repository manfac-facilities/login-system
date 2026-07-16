import Link from 'next/link'
import Reveal from '../Reveal'

function ObrasIcon() {
  // Building + scaffolding = obras e reformas
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full">
      {/* Scaffolding poles */}
      <rect x="3" y="8" width="3" height="36" rx="1.5" fill="#f85e0b" />
      <rect x="12" y="8" width="3" height="36" rx="1.5" fill="#f85e0b" />
      {/* Scaffolding planks */}
      <rect x="2.5" y="14" width="11" height="2.5" rx="1" fill="#cc4d09" />
      <rect x="2.5" y="24" width="11" height="2.5" rx="1" fill="#cc4d09" />
      <rect x="2.5" y="34" width="11" height="2.5" rx="1" fill="#cc4d09" />
      {/* Building body */}
      <rect x="17" y="18" width="27" height="26" rx="2" fill="#00345e" />
      {/* Flat roof parapet */}
      <rect x="15" y="15" width="31" height="5" rx="1.5" fill="#1a4873" />
      {/* Windows */}
      <rect x="20" y="22" width="7" height="6" rx="1" fill="white" opacity="0.18" />
      <rect x="31" y="22" width="7" height="6" rx="1" fill="white" opacity="0.18" />
      <rect x="20" y="32" width="7" height="6" rx="1" fill="white" opacity="0.18" />
      {/* Door */}
      <rect x="29" y="35" width="8" height="9" rx="1" fill="#f85e0b" opacity="0.9" />
    </svg>
  )
}

function ConstrucaoIcon() {
  // Tower crane = novas construções
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full">
      {/* Crane mast (vertical) */}
      <rect x="20" y="4" width="5" height="40" rx="2" fill="#00345e" />
      {/* Main jib (horizontal arm right) */}
      <rect x="20" y="4" width="26" height="4.5" rx="2" fill="#00345e" />
      {/* Counter jib (left) */}
      <rect x="4" y="4" width="16" height="4.5" rx="2" fill="#1a4873" />
      {/* Counterweight */}
      <rect x="4" y="8" width="9" height="9" rx="1.5" fill="#1a4873" />
      {/* Hoist rope */}
      <line x1="37" y1="8.5" x2="37" y2="30" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
      {/* Hook */}
      <path d="M35 30 L35 35 Q35 39 39 39 Q43 39 43 35" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Building frame being built */}
      <rect x="5" y="29" width="14" height="15" rx="1" fill="none" stroke="#00345e" strokeWidth="2" />
      <line x1="5" y1="37" x2="19" y2="37" stroke="#1a4873" strokeWidth="1.5" />
      <rect x="9" y="37" width="5" height="7" rx="0.5" fill="#1a4873" opacity="0.5" />
      {/* Ground */}
      <line x1="2" y1="44" x2="46" y2="44" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function ManutencaoIcon() {
  // Building + gear = manutenção predial
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full">
      {/* Building */}
      <rect x="4" y="22" width="22" height="22" rx="2" fill="#00345e" />
      {/* Flat roof */}
      <rect x="3" y="19" width="24" height="5" rx="1.5" fill="#1a4873" />
      {/* Windows */}
      <rect x="7" y="26" width="6" height="5" rx="1" fill="white" opacity="0.18" />
      <rect x="16" y="26" width="6" height="5" rx="1" fill="white" opacity="0.18" />
      {/* Door */}
      <rect x="11" y="34" width="6" height="10" rx="1" fill="#f85e0b" opacity="0.85" />
      {/* Gear body */}
      <circle cx="36" cy="31" r="9" fill="none" stroke="#f85e0b" strokeWidth="3" />
      <circle cx="36" cy="31" r="4" fill="#f85e0b" />
      <circle cx="36" cy="31" r="2" fill="#00345e" />
      {/* Gear teeth (8 teeth) */}
      <rect x="34.5" y="19.5" width="3" height="5" rx="1" fill="#f85e0b" />
      <rect x="34.5" y="37.5" width="3" height="5" rx="1" fill="#f85e0b" />
      <rect x="24.5" y="29.5" width="5" height="3" rx="1" fill="#f85e0b" />
      <rect x="42.5" y="29.5" width="5" height="3" rx="1" fill="#f85e0b" />
      <rect x="27.5" y="21.5" width="4.5" height="3" rx="1" fill="#f85e0b" transform="rotate(-45 29.75 23)" />
      <rect x="40" y="37" width="4.5" height="3" rx="1" fill="#f85e0b" transform="rotate(-45 42.25 38.5)" />
      <rect x="40" y="21.5" width="4.5" height="3" rx="1" fill="#f85e0b" transform="rotate(45 42.25 23)" />
      <rect x="27.5" y="37" width="4.5" height="3" rx="1" fill="#f85e0b" transform="rotate(45 29.75 38.5)" />
    </svg>
  )
}

function HvacIcon() {
  // Indoor AC unit + snowflake = climatização
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-full w-full">
      {/* Indoor unit body */}
      <rect x="3" y="6" width="30" height="13" rx="3" fill="#00345e" />
      {/* Unit top stripe */}
      <rect x="3" y="6" width="30" height="5" rx="3" fill="#1a4873" />
      {/* Status light */}
      <circle cx="29" cy="8.5" r="2" fill="#f85e0b" />
      {/* Airflow vanes */}
      <line x1="7" y1="15" x2="22" y2="15" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="17.5" x2="17" y2="17.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Curved airflow lines */}
      <path d="M6 22 Q10 27 6 32" stroke="#f85e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M12 22 Q17 28 12 34" stroke="#f85e0b" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M18 22 Q23 29 18 36" stroke="#f85e0b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Snowflake center */}
      <line x1="38" y1="26" x2="38" y2="44" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="29" y1="35" x2="47" y2="35" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="29" x2="44" y2="41" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="44" y1="29" x2="32" y2="41" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Snowflake tips */}
      <line x1="38" y1="26" x2="35.5" y2="28.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="38" y1="26" x2="40.5" y2="28.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="38" y1="44" x2="35.5" y2="41.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="38" y1="44" x2="40.5" y2="41.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="35" x2="31.5" y2="32.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="35" x2="31.5" y2="37.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="47" y1="35" x2="44.5" y2="32.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="47" y1="35" x2="44.5" y2="37.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const SERVICOS_HOME = [
  {
    Icon: ObrasIcon,
    slug: 'obras-e-reformas',
    title: 'Obras e Reformas Corporativas',
    description:
      'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar sua operação.',
  },
  {
    Icon: ConstrucaoIcon,
    slug: 'novas-construcoes',
    title: 'Novas Construções',
    description:
      'Do projeto à entrega das chaves com cronograma real, custo sob controle e comunicação recorrente em cada etapa.',
  },
  {
    Icon: ManutencaoIcon,
    slug: 'manutencao-predial',
    title: 'Manutenção Predial Preventiva e Corretiva',
    description:
      'Rotinas preventivas que eliminam emergências e mantêm seu prédio funcionando sem interrupções imprevistas.',
  },
  {
    Icon: HvacIcon,
    slug: 'hvac',
    title: 'Sistemas de Climatização (HVAC)',
    description:
      'Climatização funcionando, energia dentro do orçamento e manutenção preventiva com técnicos especializados.',
  },
]

export default function ServicosTeaser() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-4 bg-[var(--orange)]" />
            <p className="font-mono text-xs tracking-wide text-[var(--orange)]">Serviços</p>
          </div>
          <h2 className="mt-4 text-center text-2xl font-bold text-[var(--ink)] md:text-3xl">
            Da manutenção recorrente às obras spot. Um único ponto de responsabilidade.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICOS_HOME.map((servico, i) => (
            <Reveal key={servico.title} delay={i * 90}>
              <div className="group relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 pt-8 text-center transition-shadow hover:shadow-md">
                <div className="absolute left-1/2 top-0 h-1 w-10 -translate-x-1/2 rounded-b-full bg-[var(--orange)]" />
                <div
                  className="icon-float mx-auto mb-4 h-14 w-14"
                  style={{ animationDelay: `${i * 350}ms` }}
                >
                  <servico.Icon />
                </div>
                <h3 className="font-bold leading-snug text-[var(--orange)]">{servico.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  {servico.description}
                </p>
                <Link
                  href={`/servicos/${servico.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--orange)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--orange)] transition-colors hover:bg-[var(--orange)] hover:text-white"
                >
                  Saiba mais
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={SERVICOS_HOME.length * 90}>
          <div className="mt-8 text-center">
            <Link
              href="/servicos"
              className="text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
            >
              Ver todos os serviços →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
