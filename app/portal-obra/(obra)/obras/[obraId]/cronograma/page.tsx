import EvolucaoEtapas from '@/app/obras/obras/_ui/evolucao-etapas'
import { exigirVisao } from '../../../_lib/guarda'
import { Bloco, Vazio } from '../../../_ui/blocos'
import type { AtividadeCliente } from '../../../_lib/visao'

export const dynamic = 'force-dynamic'

const TOM: Record<AtividadeCliente['tom'], string> = {
  ok: 'text-(--obra-verde-texto)',
  atencao: 'text-(--obra-yellow-texto)',
  atraso: 'text-[#9a2a00] font-semibold',
  neutro: 'text-(--obra-text)',
}

/** Cronograma por etapa (Leva 5 §3.2): barras previsto × realizado, código exibido, nunca o numero interno. */
export default async function CronogramaPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { visao } = await exigirVisao(obraId)
  const c = visao.cronograma
  if (!c) {
    return (
      <Bloco titulo="Cronograma" id="b-crono">
        <Vazio>O cronograma desta obra está sendo preparado pela engenharia da Manfac.</Vazio>
      </Bloco>
    )
  }
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="text-[14px] text-(--obra-muted-texto)">
        Entrega prevista <span className="obra-num font-semibold text-(--obra-ink)">{c.entregaCompleta}</span>
        {c.base ? (
          <>
            {' '}· data da base <span className="obra-num">{c.base}</span>
          </>
        ) : null}
        . Por etapa: realizado (laranja) × previsto hoje (marcador azul) × base (tracejado).
      </p>
      {c.etapas.map((e) => (
        <Bloco key={e.ordem} titulo={`${e.ordem}. ${e.nome}`} id={`e-${e.ordem}`}>
          <EvolucaoEtapas linhas={[e.linha]} />
          <ul className="mt-3 divide-y divide-(--obra-border) border-t border-(--obra-border)">
            {e.atividades.map((a) => (
              <li key={a.codigo} className="grid grid-cols-[3rem_1fr] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[3.5rem_1fr_9rem_10rem] sm:items-center">
                <span className="obra-num text-[14px] text-(--obra-muted-texto)">{a.codigo}</span>
                <span className="text-[15px] text-(--obra-text)">{a.descricao}</span>
                <span className={`col-start-2 text-[14px] sm:col-start-auto ${TOM[a.tom]}`}>
                  {a.situacao} · <span className="obra-num">{a.realizado}</span>
                </span>
                <span className="obra-num col-start-2 text-[13px] text-(--obra-muted-texto) sm:col-start-auto sm:text-right">
                  {a.inicio} a {a.termino}
                  {a.delta && a.delta !== 'no prazo' ? <span className={a.delta.startsWith('+') ? ' font-semibold text-[#9a2a00]' : ''}> · {a.delta}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      ))}
    </div>
  )
}
