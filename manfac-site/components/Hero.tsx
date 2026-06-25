import Reveal from './Reveal'

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)] text-white">
      <video
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        src="/media/hero.mp4"
        poster="/media/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--ink)]/80 via-[var(--ink)]/55 to-[var(--ink)]/85" />
      <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
        <Reveal delay={0}>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
            Engenharia para grandes operações
          </p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Mais do que executar obras.
            <br />
            Estruturamos e damos visibilidade à sua operação.
          </h1>
        </Reveal>
        <Reveal delay={250}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            Gestão e execução de obras, reformas e manutenção predial para grandes operações —
            com controle, transparência e resultado.
          </p>
        </Reveal>
        <Reveal delay={380}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="/contato"
              className="rounded-md bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
            >
              Fale com a gente
            </a>
            <a
              href="/resultados"
              className="rounded-md border border-white/50 px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
            >
              Ver resultados
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
