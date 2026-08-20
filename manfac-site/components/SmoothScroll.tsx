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
 *
 * O `lenis/dist/lenis.css` **não** é importado de propósito: hoje ele não teria
 * o que fazer aqui (o site não fixa `height: 100%`, não tem iframe, nenhum
 * container com scroll próprio e ninguém chama `lenis.stop()`). Isso muda no
 * dia em que a frente B puser o mapa em `<iframe>` na `/contato` — sem o CSS,
 * o scroll prende em cima do mapa. Importar junto com o mapa.
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
