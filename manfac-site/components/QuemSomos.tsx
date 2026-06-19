const pilares = [
  {
    title: 'Gestão ativa e estruturada da operação',
    description:
      'Não tratamos obras e manutenção como demandas isoladas — estruturamos a operação como um sistema integrado.',
  },
  {
    title: 'Visibilidade e controle em tempo real',
    description:
      'Comunicação clara e recorrente, com transparência total sobre prazos, custos e andamento de cada demanda.',
  },
]

export default function QuemSomos() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
            Quem somos
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-snug md:text-3xl">
            A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
            reformas e manutenção predial para grandes operações.
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            Nosso compromisso é impulsionar o sucesso dos nossos clientes através de operações
            mais organizadas, eficientes e transparentes.
          </p>
        </div>
        <div className="space-y-6">
          {pilares.map((pilar) => (
            <div key={pilar.title} className="rounded-lg border border-[var(--border)] bg-[var(--navy)]/30 p-6">
              <h3 className="font-semibold text-white">{pilar.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{pilar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
