import Image from 'next/image'
import Reveal from './Reveal'

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/10">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M1.5 5l2.5 2.5 4.5-4.5"
          stroke="#f85e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

const SERVICOS_PAGE = [
  {
    id: 'obras-reformas',
    img: '/media/servicos-obras.jpg',
    imgAlt: 'Trabalhadores em andaime durante reforma de edifício comercial',
    label: 'Obras e Reformas Corporativas',
    headline: 'Reforma ou expansão — sem paralisar sua operação.',
    intro:
      'Escritórios, galpões, hospitais, redes de varejo. A Manfac executa qualquer escala de reforma com equipe técnica própria, cronograma definido e impacto mínimo no dia a dia dos seus colaboradores.',
    items: [
      'Reformas de layout, fachada e adequação civil',
      'Expansão de unidades e retrofit predial',
      'Cumprimento de normas técnicas e exigências legais',
      'Relatório semanal de andamento — sem precisar pedir',
      'Um ponto de contato responsável do início à entrega',
    ],
    imgLeft: true,
  },
  {
    id: 'novas-construcoes',
    img: '/media/servicos-construcao.jpg',
    imgAlt: 'Edifício comercial em construção com guindaste em ação',
    label: 'Novas Construções',
    headline: 'Do zero à entrega das chaves — prazo e custo sob controle.',
    intro:
      'A Manfac assume a gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e nenhuma surpresa no final do mês.',
    items: [
      'Gestão completa do projeto de engenharia',
      'Equipe técnica própria — sem subempreiteiros',
      'Controle rigoroso de cronograma e custo',
      'Visibilidade do andamento em tempo real',
      'Entrega com documentação e comissionamento',
    ],
    imgLeft: false,
  },
  {
    id: 'manutencao-predial',
    img: '/media/servicos-manutencao-v2.jpg',
    imgAlt: 'Técnico realizando manutenção em cobertura de edifício',
    label: 'Manutenção Predial Preventiva e Corretiva',
    headline: 'Menos emergências. Mais previsibilidade.',
    intro:
      'Manutenção reativa custa mais, para mais e frustra mais. A Manfac estrutura um plano preventivo sob medida para o seu patrimônio — e responde rápido quando o inesperado acontece.',
    items: [
      'Plano de manutenção preventiva customizado',
      'Atendimento corretivo com SLA definido em contrato',
      'Cobertura de elétrica, hidráulica, estrutura e fachada',
      'Equipe dedicada ou compartilhada por contrato',
      'Relatório mensal de demandas e status de cada chamado',
    ],
    imgLeft: true,
  },
  {
    id: 'hvac',
    img: '/media/servicos-hvac.jpg',
    imgAlt: 'Fachada de edifício com sistemas de ar-condicionado instalados',
    label: 'Sistemas de Climatização (HVAC)',
    headline: 'Climatização funcionando. Energia dentro do orçamento.',
    intro:
      'Sistema parado paralisa produtividade e onera a conta de energia. A Manfac instala, mantém e gerencia sistemas HVAC com plano preventivo dedicado e técnicos especializados — para sua equipe trabalhar confortável e seu consumo não fugir do orçamento.',
    items: [
      'Instalação de sistemas split, VRF e centrais de ar',
      'Manutenção preventiva com periodicidade definida',
      'Higienização e limpeza técnica',
      'Monitoramento de performance e consumo',
      'Atendimento de urgência com SLA garantido',
    ],
    imgLeft: false,
  },
]

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
              Uma equipe. Zero intermediário.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
              Obras, reformas, novas construções, manutenção predial e climatização — com equipe
              técnica própria e responsabilidade total do início ao fim.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {SERVICOS_PAGE.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-full border border-white/35 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:border-[var(--orange)] hover:text-[var(--orange)]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Service sections ──────────────────────────────────────────── */}
      {SERVICOS_PAGE.map((servico, i) => (
        <section
          key={servico.id}
          id={servico.id}
          className="scroll-mt-20 border-b border-[var(--border)]"
          style={{ backgroundColor: i % 2 === 0 ? 'var(--background)' : 'var(--surface)' }}
        >
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              {/* Image */}
              <Reveal
                delay={0}
                className={servico.imgLeft ? 'md:order-1' : 'md:order-2'}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image
                    src={servico.img}
                    alt={servico.imgAlt}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </Reveal>

              {/* Content */}
              <div className={servico.imgLeft ? 'md:order-2' : 'md:order-1'}>
                <Reveal delay={120}>
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                    {servico.label}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
                    {servico.headline}
                  </h2>
                  <p className="mt-4 leading-relaxed text-[var(--body-text)]">{servico.intro}</p>
                </Reveal>

                <Reveal delay={240}>
                  <ul className="mt-6 space-y-3">
                    {servico.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check />
                        <span className="text-sm text-[var(--body-text)]">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal delay={360}>
                  <a
                    href="/contato"
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--orange-hover)]"
                  >
                    Solicitar diagnóstico gratuito
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7h8M7.5 4l3.5 3-3.5 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
