const servicos = [
  {
    title: 'Obras e reformas corporativas',
    description: 'Execução de obras e reformas em unidades corporativas com padrão técnico e prazo controlado.',
  },
  {
    title: 'Novas construções',
    description: 'Gestão e execução de novas construções, do planejamento à entrega.',
  },
  {
    title: 'Manutenção predial preventiva e corretiva',
    description: 'Rotinas de manutenção que evitam falhas e reduzem custo recorrente.',
  },
  {
    title: 'Sistemas de Climatização (HVAC)',
    description: 'Instalação, manutenção e gestão de sistemas de climatização.',
  },
]

export default function Servicos() {
  return (
    <section id="servicos" className="border-y border-[var(--border)] bg-[var(--navy)]/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          Serviços
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {servicos.map((servico) => (
            <div key={servico.title} className="rounded-lg border border-[var(--border)] p-6">
              <h3 className="font-semibold text-white">{servico.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{servico.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
