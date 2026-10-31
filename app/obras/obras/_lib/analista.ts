/**
 * Analista da obra (Leva 5 §7, Task 6). Puro e sempre ligado, sem IA: a partir
 * do que o painel já lê (cálculo do cronograma, execução, restrições, plano da
 * semana/PPC, impedimentos e atraso por responsável), levanta os PONTOS A
 * EXPLICAR e transforma cada um numa pergunta objetiva ao engenheiro, com o
 * contexto em números.
 *
 * - `chave` estável = tipo + alvo (o alvo é interno: número da atividade, id
 *   da restrição/impedimento, semana). A pergunta e o contexto só mostram o
 *   código exibido da atividade (`codigosDeAtividades`), nunca o `numero`.
 * - `impressao`: os números que, se mudarem, fazem a pergunta voltar. Pergunta
 *   respondida com a mesma impressão não volta (`perguntasAbertas`).
 * - `fato`: a mesma informação em versão lado cliente (sem área interna, sem
 *   descrição de impedimento oculto) — é isso, e não a pergunta, que vai para a
 *   IA junto com a resposta. Ponto que nasce de dado oculto ao cliente é
 *   `soInterno`: a resposta fica interna sempre.
 */
import { diasUteisEntre } from './calendario'
import { CAUSA } from './causas'
import { codigosDeAtividades, deltaDiasUteis, type Responsavel } from './cronograma'
import { atrasoDoLado, dataBr, pct, textoDesvio } from './email-diario'
import type { PlanoSemana, Restricao } from './last-planner'
import type { ObraGrande } from './leitura'
import type { NumerosSituacao } from './situacao'

export type TipoPonto = 'desvio' | 'entrega' | 'execucao' | 'restricao' | 'plano' | 'impedimento' | 'atraso'

export type Ponto = {
  chave: string
  tipo: TipoPonto
  pergunta: string
  contexto: Record<string, string | number | null>
  impressao: string
  fato: string
  soInterno: boolean
}

export type DadosAnalista = {
  og: ObraGrande
  hoje: string
  restricoes: Restricao[]
  planos: PlanoSemana[]
  /** Números da última situação publicada (null = nunca publicada). */
  ultimaPublicada: NumerosSituacao | null
}

/** Pergunta já gravada (`obras_situacao_pergunta`). */
export type PerguntaSalva = {
  chave: string
  resposta: string | null
  interno: boolean
  aberta: boolean
  impressao: string | null
  respondidaPor: string | null
  respondidaEm: string | null
}

export const LIMITE_DESVIO_PP = 2
export const LIMITE_IMPEDIMENTO_DIAS = 3
/** Restrição liberada com atraso só vira pergunta se liberada nos últimos 30 dias. */
const JANELA_LIBERADA_DIAS = 30

const RESP: Record<Responsavel, string> = { cliente: 'cliente', manfac: 'Manfac', terceiro: 'terceiros', clima: 'clima' }
const DE_RESP: Record<Responsavel, string> = { cliente: 'do cliente', manfac: 'da Manfac', terceiro: 'de terceiros', clima: 'do clima' }
const RESP_RESTRICAO: Record<Restricao['responsavel'], string> = { cliente: 'cliente', manfac: 'Manfac', terceiro: 'terceiros' }
const TIPO_RESTRICAO: Record<Restricao['tipo'], string> = {
  acesso: 'acesso', material: 'material', mao_de_obra: 'mão de obra', projeto: 'projeto',
  decisao_cliente: 'decisão do cliente', equipamento: 'equipamento', outro: 'outro',
}

const num1 = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)
/** Descrição livre (sem limite no banco) cortada: a pergunta tem check ≤ 1000 e o contexto ≤ 8192 bytes. */
export const LIMITE_DESCRICAO = 300
const curto = (t: string) => (t.length > LIMITE_DESCRICAO ? `${t.slice(0, LIMITE_DESCRICAO - 1).trimEnd()}…` : t)
const dU = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const menosDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10)
}

export function pontosAExplicar(d: DadosAnalista): Ponto[] {
  const { og, hoje, restricoes, planos } = d
  const calc = og.calc
  if (!calc) return []
  const { feriados } = og
  const codigos = codigosDeAtividades(calc.atividades, feriados)
  const cod = (n: number | null) => (n === null ? null : (codigos.get(n) ?? null))
  const nome = (n: number) => curto(calc.atividades.find((a) => a.numero === n)?.descricao ?? 'Atividade')
  const alvo = (n: number | null) => {
    const c = cod(n)
    return n === null ? 'sem atividade' : c ? `${nome(n)} (${c})` : 'atividade fora da versão vigente'
  }
  const pontos: Ponto[] = []

  // 1. Desvio do avanço (abaixo do previsto além do limite).
  if (calc.desvioPP < -LIMITE_DESVIO_PP) {
    const real = pct(calc.realizado)
    const prev = pct(calc.previsto)
    pontos.push({
      chave: 'desvio:obra',
      tipo: 'desvio',
      pergunta: `Avanço realizado de ${real} contra ${prev} previstos (${num1(-calc.desvioPP)} p.p. abaixo). O que causou e qual a ação para recuperar? Até quando?`,
      contexto: { realizado: real, previsto: prev, desvioPP: calc.desvioPP },
      impressao: String(Math.round(calc.desvioPP)),
      fato: `Avanço realizado de ${real} contra ${prev} previstos (${textoDesvio(calc.desvioPP)}).`,
      soInterno: false,
    })
  }

  // 2. Data de entrega depois da base.
  if (og.terminoBase && calc.terminoProjetado > og.terminoBase) {
    const dias = deltaDiasUteis(og.terminoBase, calc.terminoProjetado, feriados)
    const base = dataBr(og.terminoBase)
    const proj = dataBr(calc.terminoProjetado)
    pontos.push({
      chave: 'entrega:obra',
      tipo: 'entrega',
      pergunta: `A entrega prevista passou de ${base} (base) para ${proj}: ${dU(dias)} a mais. O que causou e o que está sendo feito para recuperar? Até quando?`,
      contexto: { base, projetada: proj, diasUteis: dias },
      impressao: calc.terminoProjetado,
      fato: `Entrega prevista para ${proj}; na base era ${base} (${dU(dias)} a mais).`,
      soInterno: false,
    })
  }

  // 3. Atividade em execução além da duração planejada.
  for (const a of calc.atividades) {
    if (a.status !== 'em_andamento' || !a.inicioReal) continue
    const emExecucao = diasUteisEntre(a.inicioReal, hoje, feriados)
    if (emExecucao <= a.duracao) continue
    const c = cod(a.numero) ?? '—'
    pontos.push({
      chave: `execucao:${a.numero}`,
      tipo: 'execucao',
      pergunta: `${curto(a.descricao)} (${c}): ${dU(emExecucao)} em execução contra ${a.duracao} planejados, ${pct(a.percentual)} concluído. O que causou e qual a ação para recuperar? Até quando?`,
      contexto: { codigo: c, descricao: curto(a.descricao), diasEmExecucao: emExecucao, duracao: a.duracao, percentual: pct(a.percentual), termino: dataBr(a.fimProjetado) },
      impressao: `${a.duracao}|${a.fimProjetado}`,
      fato: `${curto(a.descricao)} (${c}): ${dU(emExecucao)} em execução contra ${a.duracao} planejados, ${pct(a.percentual)} concluído; término previsto ${dataBr(a.fimProjetado)}.`,
      soInterno: false,
    })
  }

  // 4. Restrição vencida (aberta depois do prazo) ou liberada depois do prazo.
  const desdeLiberada = menosDias(hoje, JANELA_LIBERADA_DIAS)
  for (const r of restricoes) {
    if (!r.prazo) continue
    const vencida = r.situacao !== 'liberada' && r.prazo < hoje
    const liberadaTarde = r.situacao === 'liberada' && !!r.liberadaEm && r.liberadaEm > r.prazo && r.liberadaEm >= desdeLiberada
    if (!vencida && !liberadaTarde) continue
    const tipo = TIPO_RESTRICAO[r.tipo] ?? r.tipo
    const resp = RESP_RESTRICAO[r.responsavel] ?? r.responsavel
    const c = cod(r.atividadeNumero)
    const ativ = c ? `atividade ${c}` : 'atividade fora da versão vigente'
    const prazo = dataBr(r.prazo)
    const lib = r.liberadaEm ? dataBr(r.liberadaEm) : null
    // Ao cliente, só restrição do cliente mostra a descrição (as demais podem citar área interna).
    const quem = r.responsavel === 'cliente' ? `"${curto(r.descricao)}" (${tipo}, ${ativ})` : `de ${tipo} da ${ativ} (responsabilidade ${r.responsavel === 'manfac' ? 'da Manfac' : 'de terceiros'})`
    pontos.push({
      chave: `restricao:${r.id}`,
      tipo: 'restricao',
      pergunta: vencida
        ? `Restrição "${curto(r.descricao)}" (${tipo}, ${alvo(r.atividadeNumero)}, ${resp}) venceu em ${prazo} e segue aberta. O que falta para liberar e qual o novo prazo?`
        : `Restrição "${curto(r.descricao)}" (${tipo}, ${alvo(r.atividadeNumero)}, ${resp}) foi liberada em ${lib}, depois do prazo de ${prazo}. Qual o efeito na obra e o que foi feito para recuperar?`,
      contexto: { descricao: curto(r.descricao), tipo, responsavel: resp, codigo: c, prazo, liberadaEm: lib, situacao: vencida ? 'vencida' : 'liberada com atraso' },
      impressao: `${vencida ? 'vencida' : 'liberada'}|${r.prazo}|${r.liberadaEm ?? ''}`,
      fato: vencida
        ? `Restrição ${quem} com prazo em ${prazo}, ainda pendente.`
        : `Restrição ${quem} liberada em ${lib}, depois do prazo de ${prazo}.`,
      soInterno: false,
    })
  }

  // 5. Itens não cumpridos do plano da semana avaliada mais recente.
  const avaliado = [...planos]
    .sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio))
    .find((p) => p.itens.some((i) => i.cumprido !== null))
  for (const i of avaliado?.itens ?? []) {
    if (i.cumprido !== false) continue
    const c = cod(i.numero) ?? '—'
    const desc = nome(i.numero)
    const meta = pct(i.metaPercentual)
    const final = i.percentualFinal === null ? '—' : pct(i.percentualFinal)
    const causa = i.causa ? CAUSA[i.causa].rotulo : null
    const semana = ddmm(avaliado!.semanaInicio)
    pontos.push({
      chave: `plano:${avaliado!.semanaInicio}:${i.numero}`,
      tipo: 'plano',
      pergunta: `Plano da semana de ${semana}: ${desc} (${c}) ficou em ${final} contra a meta de ${meta}${causa ? ` (causa: ${causa})` : ''}. O que impediu e como recupera?`,
      contexto: { semana, codigo: c, descricao: desc, meta, final, causa },
      impressao: `${meta}|${final}|${i.causa ?? ''}`,
      fato: `No plano da semana de ${semana}, ${desc} (${c}) chegou a ${final} contra a meta de ${meta}.`,
      soInterno: false,
    })
  }

  // 6. Impedimento aberto há mais de 3 dias úteis.
  for (const i of og.impedimentos) {
    if (i.categoria !== 'impedimento' || i.encerradoEm) continue
    const dias = Math.max(0, diasUteisEntre(i.abertoEm, hoje, feriados) - 1)
    if (dias <= LIMITE_IMPEDIMENTO_DIAS) continue
    const resp = i.responsavel ? RESP[i.responsavel] : 'sem responsável'
    const c = cod(i.atividadeNumero)
    pontos.push({
      chave: `impedimento:${i.id}`,
      tipo: 'impedimento',
      pergunta: `Impedimento "${curto(i.descricao)}" (${resp}${i.atividadeNumero !== null ? `, ${alvo(i.atividadeNumero)}` : ''}) aberto desde ${dataBr(i.abertoEm)}: ${dU(dias)}. O que falta para resolver e qual o plano até lá?`,
      contexto: { descricao: curto(i.descricao), responsavel: resp, codigo: c, desde: dataBr(i.abertoEm), diasUteis: dias, visivelAoCliente: i.exibirAoCliente ? 'sim' : 'não' },
      impressao: i.abertoEm,
      fato: i.exibirAoCliente
        ? `Impedimento "${curto(i.descricao)}"${i.responsavel ? ` (responsabilidade ${DE_RESP[i.responsavel]})` : ''} aberto há ${dU(dias)}.`
        : '',
      soInterno: !i.exibirAoCliente,
    })
  }

  // 7. Dias de atraso por responsável que mudaram desde a última situação publicada.
  if (og.atraso) {
    const cliente = atrasoDoLado('cliente', og, hoje)
    for (const r of ['manfac', 'cliente', 'terceiro', 'clima'] as Responsavel[]) {
      const dias = og.atraso[r]
      const antes = d.ultimaPublicada?.atraso[r] ?? 0
      if (dias <= 0 || dias === antes) continue
      const visivel = cliente?.[r] ?? 0
      pontos.push({
        chave: `atraso:${r}`,
        tipo: 'atraso',
        pergunta: `Atraso ${DE_RESP[r]}: ${dU(dias)}${d.ultimaPublicada ? ` (eram ${antes} na última situação publicada)` : ''}. O que explica e o que está sendo feito para recuperar?`,
        contexto: { responsavel: RESP[r], dias, antes: d.ultimaPublicada ? antes : null },
        impressao: String(dias),
        fato: visivel > 0 ? `${dU(visivel)} de atraso na entrega ${DE_RESP[r]}.` : '',
        // O cliente não vê esses dias por esse responsável (impedimento oculto): fica interno.
        soInterno: visivel <= 0,
      })
    }
  }
  return pontos
}

const respondidaAtual = (p: Ponto, s: PerguntaSalva | undefined) =>
  !!s && !s.aberta && !!s.resposta && s.impressao === p.impressao

export type PerguntaAberta = Ponto & { anterior: { resposta: string; interno: boolean } | null }

/**
 * Pontos que pedem resposta agora: nunca respondidos, ou respondidos com outros
 * números (a resposta anterior volta como ponto de partida).
 */
export function perguntasAbertas(pontos: Ponto[], salvas: PerguntaSalva[]): PerguntaAberta[] {
  const por = new Map(salvas.map((s) => [s.chave, s]))
  return pontos
    .filter((p) => !respondidaAtual(p, por.get(p.chave)))
    .map((p) => {
      const s = por.get(p.chave)
      return { ...p, anterior: s?.resposta ? { resposta: s.resposta, interno: s.interno } : null }
    })
}

/**
 * O que vai para a composição da situação (IA ou rascunho): só pontos
 * respondidos com os números atuais, NÃO internos (nem marcados pelo
 * engenheiro, nem nascidos de dado oculto). O fato é a versão lado cliente.
 */
export function respostasParaCliente(pontos: Ponto[], salvas: PerguntaSalva[]): { fato: string; resposta: string }[] {
  const por = new Map(salvas.map((s) => [s.chave, s]))
  return pontos.flatMap((p) => {
    const s = por.get(p.chave)
    if (p.soInterno || !respondidaAtual(p, s) || s!.interno || !p.fato) return []
    return [{ fato: p.fato, resposta: s!.resposta!.trim() }]
  })
}

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const perguntaSalvaDe = (l: Linha): PerguntaSalva => ({
  chave: String(l.chave),
  resposta: typeof l.resposta === 'string' ? l.resposta : null,
  interno: !!l.interno,
  aberta: l.aberta !== false,
  impressao: l.contexto && typeof l.contexto.impressao === 'string' ? l.contexto.impressao : null,
  respondidaPor: l.respondida_por ?? null,
  respondidaEm: l.respondida_em ?? null,
})
