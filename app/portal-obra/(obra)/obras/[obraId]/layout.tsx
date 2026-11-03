import type { ReactNode } from 'react'
import { exigirVisao } from '../../_lib/guarda'
import { obraTemMapa } from '../../_lib/mapa'
import AbasObra from './_abas'

export const dynamic = 'force-dynamic'

/**
 * Cabeçalho da obra no portal: OS, nome, "dados até" e as abas. A guarda roda
 * aqui (para não montar o cabeçalho de obra alheia) E em cada página.
 */
export default async function ObraPortalLayout({ children, params }: { children: ReactNode; params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { visao } = await exigirVisao(obraId)
  const comMapa = await obraTemMapa(obraId)
  const raiz = `/portal-obra/obras/${obraId}`
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-6 pb-16 sm:px-6">
      <div>
        {visao.os ? <p className="obra-num text-[13px] text-(--obra-muted-texto)">OS {visao.os}</p> : null}
        <h1 className="mt-1 text-[24px] leading-tight font-extrabold text-(--obra-ink) sm:text-[32px]">{visao.nome}</h1>
        <p className="mt-1 text-[14px] text-(--obra-muted-texto)">
          {visao.dadosAte ? (
            <>
              Dados até <span className="obra-num">{visao.dadosAte}</span>
            </>
          ) : (
            'Acompanhamento da obra'
          )}
        </p>
      </div>
      <AbasObra raiz={raiz} aguardando={visao.aguardando.length} comMapa={comMapa} />
      {children}
    </div>
  )
}
