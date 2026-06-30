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
        <p
          className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--orange)] animate-fade-up"
          style={{ animationDelay: '0ms' }}
        >
          Engenharia para grandes operações
        </p>
        <h1
          className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl animate-fade-up"
          style={{ animationDelay: '130ms' }}
        >
          Mais que obras.
          <br />
          Estrutura e visibilidade para sua operação.
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-lg text-white/85 animate-fade-up"
          style={{ animationDelay: '260ms' }}
        >
          A Manfac assume obras, reformas e manutenção predial com equipe própria,
          cronograma real e visibilidade diária — do início ao fim.
        </p>
        <div
          className="mt-10 flex flex-wrap justify-center gap-4 animate-fade-up"
          style={{ animationDelay: '400ms' }}
        >
          <a
            href="/contato"
            className="rounded-md bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
          >
            Falar com um especialista
          </a>
          <a
            href="/resultados"
            className="rounded-md border border-white/50 px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
          >
            Ver case de sucesso
          </a>
        </div>
      </div>
    </section>
  )
}
