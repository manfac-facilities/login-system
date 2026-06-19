const resultados = [
  { value: '+1.000', label: 'ordens de serviço por mês' },
  { value: '100%', label: 'das demandas concluídas mensalmente' },
  { value: '400+', label: 'unidades sob gestão da Manfac no RJ' },
  { value: '+R$800 mil', label: 'em obras e reformas por mês' },
]

export default function Case() {
  return (
    <section id="case" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
        Resultados
      </h2>
      <p className="mt-4 max-w-3xl text-2xl font-semibold leading-snug md:text-3xl">
        Um dos maiores varejistas do setor farmacêutico do Brasil — faturamento de mais de
        R$16 bilhões/ano e 1.600+ unidades no país — colocou a Manfac na gestão de 400+ unidades
        no Rio de Janeiro.
      </p>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Depois de 7 anos com fornecedores de baixa qualidade, sem padrão e com comunicação
        ineficiente, a Manfac estruturou gestão ativa, rotinas de acompanhamento e transparência
        total — virando referência reconhecida no estado.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {resultados.map((r) => (
          <div key={r.label} className="rounded-lg border border-[var(--border)] bg-[var(--navy)]/30 p-6 text-center">
            <p className="text-3xl font-bold text-[var(--orange)]">{r.value}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{r.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
