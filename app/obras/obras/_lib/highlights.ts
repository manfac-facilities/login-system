/**
 * Highlights automáticos do relatório de período (Leva 4 §2.3). Puro.
 * Só fatos do lado cliente (sem R$, sem impedimento oculto, sem área interna,
 * só o código exibido da atividade). O `id` é estável — não depende do texto
 * nem da ordem de exibição: etapa pela `referencia` (menor numero), atividade
 * pelo numero, semana pela segunda, impedimento pelo id. É ele que o
 * engenheiro desmarca; o `id` nunca vai ao cliente, só o `texto`.
 *
 * Regras: etapa concluída antes do término base; atividade concluída antes do
 * previsto (o da base, se houver; senão o vigente); semana com PPC ≥ 80%;
 * impedimento do cliente resolvido no período; desvio recuperado (melhorou
 * ≥ 2 p.p. entre o início e a referência).
 */
import { curvaPlanejada, curvaRealizada } from './curvas'
import { dataBr, pct, textoDesvio } from './email-diario'
import { codigosDeAtividades, deltaDiasUteis } from './cronograma'
import type { PlanoSemana } from './last-planner'
import type { ObraGrande } from './leitura'
import { ddmm, etapasDaObra, ppcSemanasDoPeriodo } from './relatorio-periodo'

export type Highlight = { id: string; texto: string }

const uteis = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`
const num = (x: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x)

export function highlightsDoPeriodo(p: {
  obra: ObraGrande
  inicio: string
  fim: string
  /** Data de referência: o fim, ou hoje se o período ainda não acabou. */
  ref: string
  planos: PlanoSemana[]
}): Highlight[] {
  const { obra: og, inicio, fim, ref } = p
  const no = (d: string | null | undefined): d is string => !!d && d >= inicio && d <= fim
  const out: Highlight[] = []

  for (const e of etapasDaObra(og)) {
    if (!e.concluida || !no(e.fimReal) || !e.fimBase || e.fimReal >= e.fimBase) continue
    out.push({
      id: `etapa-antecipada:${e.referencia}`,
      texto: `Etapa ${e.ordem} — ${e.nome} concluída em ${dataBr(e.fimReal)}, ${uteis(-deltaDiasUteis(e.fimBase, e.fimReal, og.feriados))} antes do previsto na base`,
    })
  }

  const atividades = og.calc?.atividades ?? []
  const codigos = codigosDeAtividades(atividades, og.feriados)
  const basePor = new Map((og.calcBase?.atividades ?? []).map((b) => [b.numero, b.fimPrevisto]))
  for (const a of [...atividades].sort((x, y) => (x.fimReal ?? '').localeCompare(y.fimReal ?? '') || x.numero - y.numero)) {
    const previsto = basePor.get(a.numero) ?? a.fimPrevisto
    if (a.status !== 'concluido' || !no(a.fimReal) || a.fimReal >= previsto) continue
    out.push({
      id: `atividade-antecipada:${a.numero}`,
      texto: `${codigos.get(a.numero)} — ${a.descricao} concluída em ${dataBr(a.fimReal)}, antes do previsto (${dataBr(previsto)})`,
    })
  }

  for (const s of ppcSemanasDoPeriodo(p.planos, inicio, fim, og.feriados)) {
    if (s.valor < 0.8 - 1e-9) continue
    out.push({ id: `ppc:${s.segunda}`, texto: `Semana de ${ddmm(s.segunda)}: ${pct(s.valor)} do plano cumprido (PPC)` })
  }

  for (const i of [...og.impedimentos].sort((x, y) => (x.encerradoEm ?? '').localeCompare(y.encerradoEm ?? '') || x.id.localeCompare(y.id))) {
    if (i.categoria !== 'impedimento' || i.responsavel !== 'cliente' || !i.exibirAoCliente || !no(i.encerradoEm)) continue
    out.push({ id: `impedimento-resolvido:${i.id}`, texto: `Resolvido em ${dataBr(i.encerradoEm)}: ${i.descricao}` })
  }

  // Desvio (realizado − previsto, em p.p.) no início × na referência.
  if (og.calc && atividades.length && inicio <= ref) {
    const desvio = (d: string) => {
      const prev = curvaPlanejada(atividades, [d], og.feriados)[0].valor
      const real = curvaRealizada(atividades, og.hist, [d])[0]?.valor ?? 0
      return Math.round((real - prev) * 1000) / 10 || 0
    }
    const de = desvio(inicio)
    const para = desvio(ref)
    if (para - de >= 2 - 1e-9) {
      out.push({ id: 'desvio-recuperado', texto: `Desvio recuperado em ${num(para - de)} p.p. no período: de ${textoDesvio(de)} para ${textoDesvio(para)}` })
    }
  }
  return out
}
