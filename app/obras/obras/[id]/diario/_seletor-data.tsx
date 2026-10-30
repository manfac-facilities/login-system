'use client'

/** Data do diário: trocar a data já abre o diário daquele dia (item 8 da reunião de 31/10, sem botão "ir"). */
import { useRouter } from 'next/navigation'

const ISO = /^(\d{4})-\d{2}-\d{2}$/

export default function SeletorDataDiario({ base, data }: { base: string; data: string }) {
  const router = useRouter()
  return (
    <input
      type="date"
      name="data"
      defaultValue={data}
      aria-label="Data do diário"
      onChange={(e) => {
        const v = e.target.value
        const m = ISO.exec(v)
        // Enquanto o ano é digitado, o campo passa por anos como 0002: só navega com data completa e plausível.
        if (!m || Number(m[1]) < 2000 || v === data) return
        router.push(`${base}?data=${v}`)
      }}
      className="min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-2 text-sm text-[#333336]"
    />
  )
}
