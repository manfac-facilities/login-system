const stats = [
  { value: '400+', label: 'unidades sob gestão no RJ' },
  { value: '+1.000', label: 'ordens de serviço/mês' },
  { value: '100%', label: 'das demandas concluídas no mês' },
  { value: '+R$800 mil', label: 'em obras e reformas/mês' },
]

export default function Stats() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--navy)]/30">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 text-center md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-bold text-[var(--orange)] md:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)] md:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
