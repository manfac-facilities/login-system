'use client'

import { useEffect, useRef, useState } from 'react'

function parseValue(raw: string): { prefix: string; target: number; suffix: string; ptbr: boolean } {
  const m = raw.match(/^([^0-9]*)([0-9][0-9.]*[0-9]|[0-9])([^0-9]*)$/)
  if (!m) return { prefix: '', target: 0, suffix: raw, ptbr: false }
  const ptbr = m[2].includes('.')
  const target = parseInt(m[2].replace(/\./g, ''), 10)
  return { prefix: m[1], target, suffix: m[3], ptbr }
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function Counter({ value, duration = 1800 }: { value: string; duration?: number }) {
  const { prefix, target, suffix, ptbr } = parseValue(value)
  // O valor final é o estado inicial: SSR, JS lento, JS desabilitado e
  // reduced-motion sempre veem o número real. A contagem é só enfeite.
  const [count, setCount] = useState(target)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          setCount(Math.round(easeOut(t) * target))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, duration])

  const display = ptbr ? count.toLocaleString('pt-BR') : count.toString()

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  )
}
