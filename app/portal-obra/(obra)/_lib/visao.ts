/**
 * Visão do cliente de uma OBRA (Leva 5 §3.2). Puro: recebe a leitura consolidada
 * (`lerObraGrande`), os planos semanais e as restrições, e devolve SÓ o que a
 * página do cliente mostra — textos e números já formatados, prontos para a tela.
 *
 * Regras do lado cliente (as mesmas dos e-mails e PDFs): nunca R$/peso, nunca
 * `numero` interno (só o código exibido de `codigosDeAtividades`), nunca
 * impedimento com `exibirAoCliente = false`, nunca área interna da Manfac. A
 * quebra do atraso vem de `atrasoDoLado('cliente')` (oculto que não é da
 * Manfac vira "outros fatores"). Cronograma sem versão salva (só rascunho) não
 * aparece: o cliente só vê o que foi salvo.
 */
import { diasUteisEntre } from '@/app/obras/obras/_lib/calendario'
import { compararComBase, codigosDeAtividades, sinalDaObra, type AtividadeCalculada, type Responsavel, type Sinal } from '@/app/obras/obras/_lib/cronograma'
import { curvaPlanejada, curvaRealizada, datasDaCurva, type Serie } from '@/app/obras/obras/_lib/curvas'
import { atrasoDoLado, dataBr, pct, textoDesvio } from '@/app/obras/obras/_lib/email-diario'
import { highlightsDoPeriodo } from '@/app/obras/obras/_lib/highlights'
import { ppc, type PlanoSemana, type Restricao } from '@/app/obras/obras/_lib/last-planner'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { ddmm } from '@/app/obras/obras/_lib/relatorio-periodo'
import type { SituacaoRelatorio } from '@/app/obras/obras/_lib/situacao'
import { rotuloTipo } from '@/app/obras/obras/[id]/lookahead/_tipos'
import { linhasDeEtapa, type LinhaEtapa } from '@/app/obras/obras/_ui/evolucao-etapas'

export type ItemAguardando = {
  tipo: 'impedimento' | 'decisao'
  titulo: string
  detalhe: string | null
  /** dd/mm/aaaa */
  desde: string
  diasUteis: number
  prazo: string | null
  vencida: boolean
}

export type CausaAtraso = { chave: Responsavel | 'outros'; quem: string; dias: number; cor: string; motivos: string[] }

export type AtividadeCliente = {
  codigo: string
  descricao: string
  situacao: string
  tom: 'ok' | 'atencao' | 'atraso' | 'neutro'
  realizado: string
  previsto: string
  inicio: string
  termino: string
  /** "+3 dias úteis" / "−1 dia útil" / "no prazo"; null sem base. */
  delta: string | null
  atrasada: boolean
}

export type EtapaCliente = {
  ordem: number
  nome: string
  /** Linha da evolução por etapa (base × previsto × realizado), a mesma conta da Visão geral. */
  linha: LinhaEtapa
  realizado: string
  previsto: string
  termino: string
  delta: string | null
  atividades: AtividadeCliente[]
}

export type CronogramaCliente = {
  sinal: { tom: Sinal; titulo: string; resumo: string; texto: string }
  previsto: string
  realizado: string
  desvio: string
  tomDesvio: 'ok' | 'atencao' | 'atraso'
  /** dd/mm do término projetado e dd/mm/aaaa completos. */
  entrega: string
  entregaCompleta: string
  base: string | null
  ppc: { valor: string; semana: string; naoCumpridos: number } | null
  atraso: { de: string; para: string; total: number; causas: CausaAtraso[] } | null
  curva: { base: Serie | null; previsto: Serie; realizado: Serie; hoje: string; dadosAte: string | null }
  linhasEtapa: LinhaEtapa[]
  etapas: EtapaCliente[]
}

export type VisaoCliente = {
  nome: string
  os: string | null
  dadosAte: string | null
  cronograma: CronogramaCliente | null
  aguardando: ItemAguardando[]
  highlights: string[]
  /**
   * Situação para o cliente (spec §7, Task 6): a última situação PUBLICADA pelo
   * engenheiro (nunca rascunho nem resposta do analista); null = bloco não aparece.
   */
  situacao: SituacaoRelatorio | null
}

const RESP: Record<Responsavel, string> = { cliente: 'Vocês (cliente)', manfac: 'Manfac', terceiro: 'Terceiros', clima: 'Clima' }
const COR: Record<Responsavel | 'outros', string> = { manfac: '#00345e', cliente: '#f85e0b', terceiro: '#7b5ea7', clima: '#9aa9b2', outros: '#5a7380' }
/** Selo do sinal no tom do mockup aprovado (José, 31/10). */
const TITULO_SINAL: Record<Sinal, string> = { verde: 'Em dia', amarelo: 'Atenção', vermelho: 'Atrasada' }
const ORDEM: Responsavel[] = ['manfac', 'cliente', 'terceiro', 'clima']
const FORA = 'fora da versão vigente'

export const diasUteisTxt = (n: number) => {
  const v = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n)
  return `${v} ${n === 1 ? 'dia útil' : 'dias úteis'}`
}
const deltaTxt = (d: number | null) => (d === null ? null : d === 0 ? 'no prazo' : `${d > 0 ? '+' : '−'}${diasUteisTxt(Math.abs(d))}`)
const maior = (...ds: (string | null | undefined)[]) => ds.reduce<string>((m, d) => (d && d > m ? d : m), '')

/**
 * `aguardaVisivel`: atividades travadas por impedimento do cliente aberto E visível
 * ao cliente. O motor marca `aguardando_cliente` também pelo impedimento oculto;
 * nesse caso o cliente vê o rótulo neutro dos e-mails ("outros fatores").
 */
function situacaoDe(a: AtividadeCalculada, aguardaVisivel: ReadonlySet<number>): Pick<AtividadeCliente, 'situacao' | 'tom' | 'atrasada'> {
  switch (a.situacao) {
    case 'concluida':
      return { situacao: 'Concluída', tom: 'ok', atrasada: false }
    case 'atrasada':
      return { situacao: 'Atrasada', tom: 'atraso', atrasada: true }
    case 'inicio_atrasado':
      return { situacao: 'Início atrasado', tom: 'atraso', atrasada: true }
    case 'aguardando_cliente':
      return aguardaVisivel.has(a.numero)
        ? { situacao: 'Aguardando vocês', tom: 'atencao', atrasada: false }
        : { situacao: 'Aguardando outros fatores', tom: 'atencao', atrasada: false }
    case 'bloqueada':
      return { situacao: 'Aguardando liberação', tom: 'atencao', atrasada: false }
    default:
      return a.status === 'em_andamento' || a.percentual > 0
        ? { situacao: 'Em andamento', tom: 'neutro', atrasada: false }
        : { situacao: 'Não iniciada', tom: 'neutro', atrasada: false }
  }
}

/** Itens que dependem do cliente: impedimentos do cliente abertos (visíveis) e restrições do cliente não liberadas. */
export function aguardandoCliente(og: ObraGrande, restricoes: Restricao[], hoje: string): ItemAguardando[] {
  const codigos = codigosDeAtividades(og.calc?.atividades ?? [], og.feriados)
  const descricao = (n: number) => og.plano.find((a) => a.numero === n)?.descricao
  const atividade = (n: number | null) => {
    if (n === null) return null
    const c = codigos.get(n)
    return c ? `atividade ${c} — ${descricao(n) ?? ''}`.trim() : `atividade ${FORA}`
  }
  const uteis = (desde: string) => Math.max(0, diasUteisEntre(desde, hoje, og.feriados) - 1)

  const impedimentos: ItemAguardando[] = og.impedimentos
    .filter((i) => i.categoria === 'impedimento' && i.responsavel === 'cliente' && i.exibirAoCliente && !i.encerradoEm)
    .sort((a, b) => a.abertoEm.localeCompare(b.abertoEm))
    .map((i) => ({
      tipo: 'impedimento',
      titulo: i.descricao,
      detalhe: [i.tipo, atividade(i.atividadeNumero)].filter(Boolean).join(' · ') || null,
      desde: dataBr(i.abertoEm),
      diasUteis: uteis(i.abertoEm),
      prazo: null,
      vencida: false,
    }))

  const decisoes: ItemAguardando[] = restricoes
    .filter((r) => r.responsavel === 'cliente' && r.situacao !== 'liberada')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
    .map((r) => {
      const desde = String(r.criadoEm).slice(0, 10)
      const okDesde = /^\d{4}-\d{2}-\d{2}$/.test(desde)
      return {
        tipo: 'decisao',
        titulo: r.descricao,
        detalhe: [rotuloTipo(r.tipo), atividade(r.atividadeNumero)].filter(Boolean).join(' · ') || null,
        desde: okDesde ? dataBr(desde) : '—',
        diasUteis: okDesde ? uteis(desde) : 0,
        prazo: r.prazo ? dataBr(r.prazo) : null,
        vencida: !!r.prazo && r.prazo < hoje,
      }
    })
  return [...impedimentos, ...decisoes]
}

/** Motivos (visíveis ao cliente) do atraso de cada responsável: os impedimentos que contaram dias. */
function motivosDe(og: ObraGrande, r: Responsavel): string[] {
  return og.impedimentos
    .filter((i) => i.categoria === 'impedimento' && i.exibirAoCliente && i.responsavel === r)
    .filter((i) => (i.travaAtividade ? true : (i.impactoDias ?? 0) > 0))
    .map((i) => `${i.descricao} (${i.encerradoEm ? `${ddmm(i.abertoEm)} a ${ddmm(i.encerradoEm)}` : `desde ${ddmm(i.abertoEm)}`})`)
}

function cronogramaCliente(og: ObraGrande, planos: PlanoSemana[], hoje: string): CronogramaCliente | null {
  const { calc, calcBase, feriados, obra } = og
  // Só versão salva vai ao cliente (rascunho é trabalho interno).
  if (!calc || !og.versaoVigente || !calc.atividades.length) return null

  const atraso = og.terminoBase ? atrasoDoLado('cliente', og, hoje) : null
  const desvio = calc.desvioPP
  const clienteAberto = og.impedimentos.some(
    (i) => i.categoria === 'impedimento' && i.responsavel === 'cliente' && i.exibirAoCliente && !i.encerradoEm,
  )
  // Sinal recalculado só com o que o cliente vê (o `og.sinal` conta impedimento oculto do cliente).
  const sinal: Sinal = sinalDaObra({ desvioPP: desvio, terminoProjetado: calc.terminoProjetado, terminoBase: og.terminoBase, impedimentoClienteAberto: clienteAberto })
  const resumo =
    atraso && atraso.total > 0
      ? `Entrega prevista ${diasUteisTxt(atraso.total)} depois da base`
      : clienteAberto
        ? 'Uma pendência de vocês está segurando parte da obra'
        : desvio < 0
          ? 'Avanço um pouco abaixo do planejado'
          : 'Obra dentro do planejado'
  const texto = `Avanço realizado de ${pct(calc.realizado)} contra ${pct(calc.previsto)} previstos até hoje (${textoDesvio(desvio)}). Entrega prevista para ${dataBr(calc.terminoProjetado)}${
    og.terminoBase && og.terminoBase !== calc.terminoProjetado ? `; na base era ${dataBr(og.terminoBase)}` : ''
  }.`

  // PPC: a semana avaliada mais recente.
  const avaliada = [...planos]
    .sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio))
    .find((p) => p.itens.some((i) => i.cumprido !== null))
  const ppcSemana = avaliada
    ? (() => {
        const av = avaliada.itens.filter((i) => i.cumprido !== null)
        const v = ppc(avaliada.itens)
        return v === null ? null : { valor: `${av.filter((i) => i.cumprido).length} de ${av.length}`, semana: ddmm(avaliada.semanaInicio), naoCumpridos: av.filter((i) => !i.cumprido).length }
      })()
    : null

  const causas: CausaAtraso[] = []
  if (atraso && atraso.total > 0) {
    for (const r of ORDEM) if (atraso[r] > 0) causas.push({ chave: r, quem: RESP[r], dias: atraso[r], cor: COR[r], motivos: motivosDe(og, r) })
    if (atraso.outros > 0) causas.push({ chave: 'outros', quem: 'Outros fatores', dias: atraso.outros, cor: COR.outros, motivos: [] })
  }

  // Curva S (mesmas séries do painel): data-base até o maior entre término, base, dados até e hoje.
  const inicio = obra.data_base ?? calc.atividades.reduce((m, a) => (a.inicioPrevisto < m ? a.inicioPrevisto : m), calc.terminoPrevisto)
  const fim = maior(calc.terminoPrevisto, calcBase?.terminoPrevisto, og.dadosAte, hoje <= calc.terminoProjetado ? hoje : null, inicio)
  const datas = [...new Set([inicio, ...datasDaCurva(inicio, fim, 'semana')])].sort()

  const codigos = codigosDeAtividades(calc.atividades, feriados)
  const aguardaVisivel = new Set(
    og.impedimentos
      .filter((i) => i.categoria === 'impedimento' && i.responsavel === 'cliente' && i.exibirAoCliente && i.travaAtividade && !i.encerradoEm && i.atividadeNumero !== null)
      .map((i) => i.atividadeNumero as number),
  )
  const comparacao = compararComBase(calc.atividades, calcBase?.atividades ?? null, feriados)
  const linhas = linhasDeEtapa(og.etapas, calc.atividades, calcBase?.atividades ?? null, feriados)
  const etapas: EtapaCliente[] = og.etapas.map((e, i) => {
    const nums = new Set(e.numeros)
    const l = linhas[i]
    return {
      ordem: i + 1,
      nome: e.etapa,
      linha: l,
      realizado: pct(l.realizado),
      previsto: pct(l.previsto),
      termino: dataBr(e.fimProjetado),
      delta: deltaTxt(l.deltaDias),
      atividades: calc.atividades
        .filter((a) => nums.has(a.numero))
        .map((a) => ({
          codigo: codigos.get(a.numero) ?? '',
          descricao: a.descricao,
          ...situacaoDe(a, aguardaVisivel),
          realizado: pct(a.percentual),
          previsto: pct(a.percentualPrevisto),
          inicio: dataBr(a.inicioReal ?? a.inicioProjetado),
          termino: dataBr(a.fimReal ?? a.fimProjetado),
          delta: deltaTxt(comparacao.get(a.numero)?.deltaDias ?? null),
        })),
    }
  })

  return {
    sinal: { tom: sinal, titulo: TITULO_SINAL[sinal], resumo, texto },
    previsto: pct(calc.previsto),
    realizado: pct(calc.realizado),
    desvio: textoDesvio(desvio),
    tomDesvio: desvio < -5 ? 'atraso' : desvio < 0 ? 'atencao' : 'ok',
    entrega: ddmm(calc.terminoProjetado),
    entregaCompleta: dataBr(calc.terminoProjetado),
    base: og.terminoBase ? dataBr(og.terminoBase) : null,
    ppc: ppcSemana,
    atraso:
      atraso && atraso.total > 0 && og.terminoBase
        ? { de: dataBr(og.terminoBase), para: dataBr(calc.terminoProjetado), total: atraso.total, causas }
        : null,
    curva: {
      base: calcBase ? curvaPlanejada(calcBase.atividades, datas, feriados) : null,
      previsto: curvaPlanejada(calc.atividades, datas, feriados),
      realizado: curvaRealizada(calc.atividades, og.hist, datas),
      hoje,
      dadosAte: og.dadosAte,
    },
    linhasEtapa: linhas,
    etapas,
  }
}

const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

export function montarVisaoCliente(p: {
  obra: ObraGrande
  planos: PlanoSemana[]
  restricoes: Restricao[]
  hoje: string
  situacao?: SituacaoRelatorio | null
}): VisaoCliente {
  const { obra: og, hoje } = p
  const o = og.obra
  const cronograma = cronogramaCliente(og, p.planos, hoje)
  // Destaques automáticos dos últimos 30 dias (só fatos do lado cliente; só o texto, nunca o id).
  const highlights = cronograma
    ? highlightsDoPeriodo({ obra: og, inicio: somarDias(hoje, -30), fim: hoje, ref: hoje, planos: p.planos }).map((h) => h.texto)
    : []
  return {
    nome: o.loja?.trim() || o.descricao?.trim() || o.os || 'Obra',
    os: o.os ?? null,
    dadosAte: og.dadosAte ? dataBr(og.dadosAte) : null,
    cronograma,
    aguardando: aguardandoCliente(og, p.restricoes, hoje),
    highlights,
    situacao: p.situacao ?? null,
  }
}

