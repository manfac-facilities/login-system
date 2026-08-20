'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Scroll interpolado (Lenis), montado uma vez no layout raiz.
 *
 * É isto — e não o `.reveal`, que o site já tinha — que dá a sensação de peso e
 * continuidade da referência. O reveal só entrega o efeito de entrada; o Lenis
 * muda como a página inteira responde à roda do mouse.
 *
 * `autoRaf: true` deixa o próprio Lenis rodar o requestAnimationFrame, o que
 * dispensa o loop manual e um estado a menos para errar.
 */
export default function SmoothScroll() {
  useEffect(() => {
    // Respeitar quem pediu menos movimento no sistema: aqui não há como fazer
    // isso por CSS, então a checagem é explícita e o Lenis nem chega a subir.
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (semMovimento.matches) return

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      autoRaf: true,
    })

    // Sem destroy(), navegar entre páginas empilharia instâncias, cada uma
    // disputando o scroll com as anteriores.
    return () => lenis.destroy()
  }, [])

  return null
}
