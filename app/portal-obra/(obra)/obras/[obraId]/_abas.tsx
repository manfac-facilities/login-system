'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Abas da obra no portal: rolam na horizontal no celular, alvo ≥ 44px, aba atual com `aria-current`.
 * "Mapa" (Leva 6) só aparece quando a obra tem mapa (`comMapa`).
 */
export const ABAS = [
  { seg: '', rotulo: 'Visão geral' },
  { seg: 'cronograma', rotulo: 'Cronograma' },
  { seg: 'aguardando', rotulo: 'Aguardando vocês' },
  { seg: 'relatorios', rotulo: 'Diários e relatórios' },
  { seg: 'galeria', rotulo: 'Galeria' },
  { seg: 'mapa', rotulo: 'Mapa' },
  { seg: 'documentos', rotulo: 'Documentos' },
  { seg: 'mensagens', rotulo: 'Mensagens' },
] as const

export default function AbasObra({ raiz, aguardando, comMapa = false }: { raiz: string; aguardando: number; comMapa?: boolean }) {
  const caminho = usePathname()
  return (
    <nav aria-label="Seções da obra" className="-mx-4 overflow-x-auto border-b border-(--obra-border) px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {ABAS.filter((a) => a.seg !== 'mapa' || comMapa).map((a) => {
          const href = a.seg ? `${raiz}/${a.seg}` : raiz
          const atual = a.seg ? caminho === href || caminho.startsWith(`${href}/`) : caminho === raiz
          return (
            <li key={a.seg}>
              <Link
                href={href}
                aria-current={atual ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-1.5 border-b-[3px] px-3 text-[15px] whitespace-nowrap ${
                  atual ? 'border-(--obra-orange) font-bold text-(--obra-ink)' : 'border-transparent text-(--obra-text) hover:text-(--obra-ink)'
                }`}
              >
                {a.rotulo}
                {a.seg === 'aguardando' && aguardando > 0 ? (
                  <span className="obra-num inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#b33a00] px-1.5 text-[12px] font-bold text-white">
                    <span className="sr-only">: </span>
                    {aguardando}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
