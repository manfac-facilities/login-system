const diferenciais = [
  'Gestão ativa e estruturada',
  'Transparência total',
  'Comunicação clara e recorrente',
  'Uso de tecnologia e dados',
  'Proatividade na resolução de problemas',
]

export default function Diferencial() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--navy)]/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          Diferencial
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {diferenciais.map((d) => (
            <span
              key={d}
              className="rounded-full border border-[var(--border)] px-5 py-2 text-sm text-white"
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-xl font-semibold leading-snug text-white">
          &ldquo;Não escondemos problemas. Assumimos, tratamos e evoluímos continuamente.&rdquo;
        </p>
      </div>
    </section>
  )
}
