/**
 * Pré-preenchimento do diário (spec §5.3, brief da Task 8). Puro: sem banco.
 *
 * - Atividades do dia: em andamento + não iniciadas com início previsto ≤ data,
 *   e as que já estiverem no rascunho salvo. `atual` = percentual da execução.
 * - `outras`: as demais atividades não concluídas da versão, para "Incluir outra
 *   atividade" (antecipar frente de trabalho — itens 6/11 da reunião de 31/10).
 * - Sem rascunho: efetivo/equipe do último diário da obra; programação de amanhã
 *   sugerida com as atividades cujo início previsto é o próximo dia útil.
 */
import { podeIniciar, type AtividadeExec, type AtividadePlano, type ResultadoCronograma } from '../../_lib/cronograma'
import { somarDiasUteis } from '../../_lib/calendario'
import type { AtividadeDiario, AvancoRdo, RascunhoRdo } from './_tipos'

export function montarDiario(p: {
  calc: ResultadoCronograma
  plano: AtividadePlano[]
  exec: AtividadeExec[]
  atividadeTrava: number | null
  feriados: ReadonlySet<string>
  data: string
  /** Rascunho/RDO já gravado para o dia (sem os avanços). */
  rdo: Omit<RascunhoRdo, 'avancos'> | null
  avancosSalvos: AvancoRdo[]
  ultimo: { efetivo: number | null; equipeTexto: string | null } | null
}): { inicial: RascunhoRdo; atividades: AtividadeDiario[]; outras: AtividadeDiario[] } {
  const salvos = new Map(p.avancosSalvos.map((a) => [a.numero, a]))
  const doDia = (a: ResultadoCronograma['atividades'][number]) =>
    salvos.has(a.numero) || a.status === 'em_andamento' || (a.status === 'nao_iniciado' && a.inicioPrevisto <= p.data)
  const linha = (a: ResultadoCronograma['atividades'][number]): AtividadeDiario => {
    const t = podeIniciar(a.numero, p.plano, p.exec, p.atividadeTrava)
    return {
      numero: a.numero,
      etapa: a.etapa,
      descricao: a.descricao,
      atual: a.percentual,
      travada: !t.ok,
      motivoTrava: t.ok ? null : t.motivo,
    }
  }
  const atividades: AtividadeDiario[] = p.calc.atividades.filter(doDia).map(linha)
  const outras: AtividadeDiario[] = p.calc.atividades.filter((a) => !doDia(a) && a.status !== 'concluido').map(linha)

  const avancos: AvancoRdo[] = atividades.map(
    (a) => salvos.get(a.numero) ?? { numero: a.numero, de: a.atual, para: a.atual, concluida: false, causa: null },
  )

  if (p.rdo) return { inicial: { ...p.rdo, avancos }, atividades, outras }

  const amanha = somarDiasUteis(p.data, 1, p.feriados)
  const sugestao = p.calc.atividades
    .filter((a) => a.inicioPrevisto === amanha)
    .map((a) => `${a.numero} · ${a.descricao}`)
    .join('\n')
  return {
    inicial: {
      semExecucao: false,
      motivoSemExecucao: null,
      efetivo: p.ultimo?.efetivo ?? null,
      equipeTexto: p.ultimo?.equipeTexto ?? null,
      clima: null,
      climaManha: null,
      climaTarde: null,
      programacaoAmanha: sugestao || null,
      semImpedimento: false,
      avancos,
    },
    atividades,
    outras,
  }
}
