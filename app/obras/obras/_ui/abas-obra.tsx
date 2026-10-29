'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ABAS = [
  { sufixo: '', label: 'Painel' },
  { sufixo: '/cronograma', label: 'Cronograma' },
  { sufixo: '/diario', label: 'Diário' },
  { sufixo: '/impedimentos', label: 'Impedimentos' },
  { sufixo: '/comunicacao', label: 'Comunicação' },
]

export default function AbasObra({ obraId }: { obraId: string }) {
  const pathname = usePathname()
  const raiz = `/obras/obras/${obraId}`
  return (
    <nav aria-label="Seções da obra" className="flex gap-2 overflow-x-auto">
      {ABAS.map((a) => {
        const href = raiz + a.sufixo
        const atual = a.sufixo === '' ? pathname === raiz : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={atual ? 'page' : undefined}
            className={
              'whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
              (atual
                ? 'border-[#f05a28] bg-[#f05a28] font-semibold text-white'
                : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#f05a28] hover:text-white')
            }
          >
            {a.label}
          </Link>
        )
      })}
    </nav>
  )
}
