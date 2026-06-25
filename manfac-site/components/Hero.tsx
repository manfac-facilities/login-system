'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const Hero3D = dynamic(() => import('./Hero3D'), { ssr: false })

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const [ready, setReady] = useState(false)
  const [simplified] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(cb)
        : window.setTimeout(cb, 200)
    idle(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return

    const onScroll = () => {
      const el = sectionRef.current
      if (!el) return
      const height = el.offsetHeight || 1
      const p = 1 - Math.min(Math.max(window.scrollY / height, 0), 1)
      setProgress(1 - p)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ready])

  return (
    <section
      ref={sectionRef}
      className="blueprint-grid relative isolate overflow-hidden border-b border-[var(--border)]"
    >
      <div className="absolute inset-0 -z-10">
        {ready && <Hero3D progress={progress} simplified={simplified} />}
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          Engenharia para grandes operações
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-[var(--ink)] md:text-6xl">
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
            href="/contato"
            className="rounded-md bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
          >
            Fale com a gente
          </a>
          <a
            href="/resultados"
            className="rounded-md border border-[var(--border)] px-6 py-3 font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface)]"
          >
            Ver resultados
          </a>
        </div>
      </div>
    </section>
  )
}
