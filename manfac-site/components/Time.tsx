const impacto = [
  'Mais previsibilidade',
  'Mais controle',
  'Mais eficiência',
  'Menos retrabalho',
  'Melhor tomada de decisão',
]

export default function Time() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
            Nosso time
          </h2>
          <p className="mt-4 text-xl font-semibold leading-snug">
            Senso de urgência, responsabilidade e foco em resultado.
          </p>
          <p className="mt-4 text-[var(--muted)]">
            Proximidade com o cliente e comunicação direta em cada etapa da operação.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
            Impacto desejado
          </h2>
          <ul className="mt-4 space-y-2">
            {impacto.map((i) => (
              <li key={i} className="flex items-center gap-3 text-[var(--muted)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--orange)]" />
                {i}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Resultado não é discurso — é consistência ao longo do tempo.
          </p>
        </div>
      </div>
    </section>
  )
}
