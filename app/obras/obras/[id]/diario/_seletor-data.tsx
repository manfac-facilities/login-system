'use client'

/**
 * Data do diário: escolher a data já abre o diário daquele dia (item 8 da reunião de 31/10, sem botão "ir").
 * Escolha pelo calendário navega na hora. Digitando, só navega quando a data está completa e confirmada
 * (Enter ou sair do campo): senão o "1" de "15" já pularia para o dia 01.
 */
import { useRef } from 'react'
import { useRouter } from 'next/navigation'

const ISO = /^(\d{4})-\d{2}-\d{2}$/

export default function SeletorDataDiario({ base, data }: { base: string; data: string }) {
  const router = useRouter()
  const digitando = useRef(false)

  function ir(v: string) {
    const m = ISO.exec(v)
    // Enquanto o ano é digitado, o campo passa por anos como 0002: só navega com data completa e plausível.
    if (!m || Number(m[1]) < 2000 || v === data) return
    router.push(`${base}?data=${v}`)
  }

  return (
    <input
      type="date"
      name="data"
      defaultValue={data}
      aria-label="Data do diário"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          digitando.current = false
          ir(e.currentTarget.value)
        } else if (e.key !== 'Tab') digitando.current = true
      }}
      onPointerDown={() => (digitando.current = false)}
      onChange={(e) => {
        if (!digitando.current) ir(e.target.value)
      }}
      onBlur={(e) => {
        if (digitando.current) ir(e.target.value)
        digitando.current = false
      }}
      className="min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-2 text-sm text-[#333336]"
    />
  )
}
