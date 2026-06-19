export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="absolute inset-0 bg-[var(--navy)] opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          Engenharia para grandes operações
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Mais do que executar obras.
          <br />
          Estruturamos e damos visibilidade à sua operação.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
          Gestão e execução de obras, reformas e manutenção predial para grandes operações —
          com controle, transparência e resultado.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href="#contato"
            className="rounded-md bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
          >
            Fale com a gente
          </a>
          <a
            href="#case"
            className="rounded-md border border-[var(--border)] px-6 py-3 font-medium text-white transition-colors hover:bg-white/5"
          >
            Ver resultados
          </a>
        </div>
      </div>
    </section>
  )
}
