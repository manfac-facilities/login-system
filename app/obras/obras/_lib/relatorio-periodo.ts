/**
 * Relatórios de período da OBRA (Leva 4 §2.1): mensal, fase e entrega. Puro.
 *
 * `blocosDoPeriodo` é a base comum com o semanal (`email-semanal.ts`): avanço
 * na data de referência, previsão de entrega, concluídas no período, em
 * andamento, o que depende do cliente e impedimentos do período, já filtrados
 * por lado. `montarConteudoPeriodo` acrescenta curva S, marcos, PPC médio,
 * highlights e (entrega) o comparativo base × final.
 *
 * Lado cliente NUNCA mostra R$, impedimento com `exibirAoCliente = false`, área
 * interna da Manfac nem `numero` (só o código exibido de `codigosDeAtividades`).
 */
import { curvaPlanejada, curvaRealizada, datasDaCurva } from './curvas'
import { dataBr, pct, previsaoEntrega, quebraDoAtraso, sinalVisual, textoDesvio, type ItemDiario, type SinalVisual } from './email-diario'
import { dataEnvioSemanal, ppc, type PlanoSemana, type Restricao } from './last-planner'
import type { ImpedimentoRow, ObraGrande } from './leitura'
import { codigosDeAtividades, deltaDiasUteis, type Responsavel } from './cronograma'
import { rotuloTipo } from '../[id]/lookahead/_tipos'
import { ISO, lista, nums, obj, str, strOuNull, strs, type Campos } from './conteudo-valido'

export { esc } from './conteudo-valido'

export type Lado = 'cliente' | 'interno'
export type TipoPeriodo = 'mensal' | 'fase' | 'entrega'

const RESP: Record<Responsavel, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }
const FORA_DA_VERSAO = 'Atividade fora da versão vigente'
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const DIA_MS = 86_400_000
const ms = (d: string) => {
  const [a, m, x] = d.split('-').map(Number)
  return Date.UTC(a, m - 1, x)
}

export type BlocosDoPeriodo = {
  loja: string
  sinal: SinalVisual
  avanco: { previsto: string; realizado: string; desvio: string }
  previsao: string
  concluidas: { descricao: string; fim: string }[]
  emAndamento: { descricao: string; percentual: string; termino: string }[]
  doCliente: { descricao: string; atividade: string; tipo: string; prazo: string | null; vencida: boolean }[]
  impedimentos: ItemDiario[]
  /** Só no interno: impedimentos do período com `exibirAoCliente = false`. */
  ocultos: ItemDiario[]
  /** Descrição da atividade no plano vigente (ou "fora da versão vigente"). */
  descricao: (numero: number) => string
  codigos: Map<number, string>
}

/** Base comum do semanal e dos relatórios de período: [inicio, fim], dados até `ref`. */
export function blocosDoPeriodo(p: {
  lado: Lado
  obra: ObraGrande
  inicio: string
  fim: string
  ref: string
  hoje: string
  restricoes: Restricao[]
}): BlocosDoPeriodo {
  const { lado, obra: og, inicio, fim, ref } = p
  const { obra, plano } = og
  const interno = lado === 'interno'
  const loja = obra.loja?.trim() || obra.descricao?.trim() || obra.os || 'Obra'
  const descricao = (n: number) => plano.find((a) => a.numero === n)?.descricao || FORA_DA_VERSAO
  // Código exibido ("2.3"), nunca o numero interno — a mesma fonte do lookahead e do cronograma.
  const codigos = codigosDeAtividades(og.calc?.atividades ?? [], og.feriados)
  const atividadeCom = (n: number) => {
    const c = codigos.get(n)
    return c ? `${c} — ${descricao(n)}` : 'fora da versão vigente'
  }

  // Avanço planejado na referência × realizado (referência passada: o realizado vem do histórico até a data).
  const calc = og.calc
  const previsto = calc?.previsto ?? 0
  const realizado =
    calc && ref < p.hoje && og.hist.length ? (curvaRealizada(calc.atividades, og.hist, [ref])[0]?.valor ?? 0) : (calc?.realizado ?? 0)
  const desvioPP = Math.round((realizado - previsto) * 1000) / 10 || 0

  const atividades = calc?.atividades ?? []
  const concluidas = atividades
    .filter((a) => a.status === 'concluido' && a.fimReal && a.fimReal >= inicio && a.fimReal <= fim)
    .sort((a, b) => a.fimReal!.localeCompare(b.fimReal!) || a.numero - b.numero)
    .map((a) => ({ descricao: a.descricao, fim: dataBr(a.fimReal!) }))
  const emAndamento = atividades
    .filter((a) => a.status !== 'concluido' && a.percentual > 0)
    .sort((a, b) => a.fimProjetado.localeCompare(b.fimProjetado) || a.numero - b.numero)
    .map((a) => ({ descricao: a.descricao, percentual: pct(a.percentual), termino: dataBr(a.fimProjetado) }))

  // Decisões/restrições que dependem do cliente: só as em aberto (liberada some).
  const doCliente = p.restricoes
    .filter((r) => r.responsavel === 'cliente' && r.situacao !== 'liberada')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
    .map((r) => ({
      descricao: r.descricao,
      atividade: atividadeCom(r.atividadeNumero),
      tipo: rotuloTipo(r.tipo),
      prazo: r.prazo ? dataBr(r.prazo) : null,
      vencida: !!r.prazo && r.prazo < ref,
    }))

  // Impedimentos que estiveram abertos em algum dia do período.
  const doPeriodo = og.impedimentos.filter(
    (i) => i.categoria === 'impedimento' && i.abertoEm <= fim && (i.encerradoEm === null || i.encerradoEm >= inicio),
  )
  const itemDe = (i: ImpedimentoRow): ItemDiario => {
    const resp = i.responsavel ? RESP[i.responsavel] : '—'
    // Ao cliente, o tipo só aparece quando é do cliente ou do clima: o da Manfac/terceiro é área interna.
    const mostraTipo = interno || i.responsavel === 'cliente' || i.responsavel === 'clima'
    const quando = i.encerradoEm ? `${ddmm(i.abertoEm)} a ${ddmm(i.encerradoEm)}` : `aberto desde ${ddmm(i.abertoEm)}`
    const extras = [
      mostraTipo && i.tipo ? i.tipo : null,
      i.atividadeNumero === null
        ? null
        : codigos.has(i.atividadeNumero)
          ? `atividade ${codigos.get(i.atividadeNumero)} (${descricao(i.atividadeNumero)})`
          : 'atividade fora da versão vigente',
    ].filter(Boolean)
    return { rotulo: `${resp.toUpperCase()} · ${quando}`, corpo: `${i.descricao}${extras.length ? ` — ${extras.join(' · ')}` : ''}` }
  }

  return {
    loja,
    sinal: sinalVisual(og.sinal),
    avanco: { previsto: pct(previsto), realizado: pct(realizado), desvio: textoDesvio(desvioPP) },
    previsao: previsaoEntrega(lado, og, ref),
    concluidas,
    emAndamento,
    doCliente,
    impedimentos: doPeriodo.filter((i) => i.exibirAoCliente).map(itemDe),
    ocultos: interno ? doPeriodo.filter((i) => !i.exibirAoCliente).map(itemDe) : [],
    descricao,
    codigos,
  }
}

// ---- Etapas -----------------------------------------------------------------

export type EtapaDaObra = {
  /**
   * Identidade da fase (referência do relatório e da agenda): o menor `numero`
   * das atividades da etapa. O numero é imutável, então a fase continua a
   * mesma quando outra etapa é inserida/removida antes dela. Nunca exibido.
   */
  referencia: string
  /** 1-based, na ordem de exibição atual (só rótulo: "etapa 2 — Alvenaria"). */
  ordem: number
  nome: string
  numeros: number[]
  /** Maior fim previsto (vigente) das atividades da etapa — data de envio da fase. */
  fimPrevisto: string
  /** Maior fim previsto das mesmas atividades na base (v1); null sem base. */
  fimBase: string | null
  concluida: boolean
  /** Menor início real (sem nenhum, o menor início previsto); só na etapa concluída. */
  inicioReal: string | null
  /** Maior fim real; só na etapa concluída. */
  fimReal: string | null
}

const maxD = (d: string[]) => d.reduce((m, x) => (x > m ? x : m))
const minD = (d: string[]) => d.reduce((m, x) => (x < m ? x : m))

/** Etapas do cronograma vigente, com a conclusão e o fim da base. */
export function etapasDaObra(og: ObraGrande): EtapaDaObra[] {
  const atividades = og.calc?.atividades ?? []
  const basePor = new Map((og.calcBase?.atividades ?? []).map((b) => [b.numero, b]))
  return og.etapas.map((e, i) => {
    const as = atividades.filter((a) => e.numeros.includes(a.numero))
    const concluida = as.length > 0 && as.every((a) => a.status === 'concluido' && !!a.fimReal)
    const base = e.numeros.map((n) => basePor.get(n)?.fimPrevisto).filter((d): d is string => !!d)
    const inicios = as.map((a) => a.inicioReal).filter((d): d is string => !!d)
    return {
      referencia: String(Math.min(...e.numeros)),
      ordem: i + 1,
      nome: e.etapa,
      numeros: e.numeros,
      fimPrevisto: e.fim,
      fimBase: base.length ? maxD(base) : null,
      concluida,
      inicioReal: concluida ? (inicios.length ? minD(inicios) : minD(as.map((a) => a.inicioPrevisto))) : null,
      fimReal: concluida ? maxD(as.map((a) => a.fimReal!)) : null,
    }
  })
}

const diasUteisTxt = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`

// ---- Conteúdo do relatório de período --------------------------------------

export type PontoCurva = { data: string; base: number | null; previsto: number; realizado: number | null }

export type ConteudoPeriodo = {
  lado: Lado
  tipo: TipoPeriodo
  referencia: string
  loja: string
  assunto: string
  titulo: string
  subtitulo: string
  inicio: string
  fim: string
  sinal: SinalVisual
  /** `ate`: "dd/mm/aaaa" da data de referência (fim do período, ou hoje se ainda não acabou). */
  avanco: { previsto: string; realizado: string; desvio: string; ate: string }
  previsao: string
  /** Curva S da data-base até a referência (fração 0–1). */
  curva: PontoCurva[]
  /** Etapas concluídas no período: fim da base × real. */
  marcos: { etapa: string; base: string | null; real: string; desvio: string | null }[]
  concluidas: { descricao: string; fim: string }[]
  emAndamento: { descricao: string; percentual: string; termino: string }[]
  /** Média do PPC das semanas avaliadas do período; null sem semana avaliada. */
  ppc: { valor: string; semanas: number } | null
  doCliente: { descricao: string; atividade: string; tipo: string; prazo: string | null; vencida: boolean }[]
  impedimentos: ItemDiario[]
  ocultos: ItemDiario[]
  /** Textos dos highlights marcados (+ o livre) — só o que vai ao cliente. */
  highlights: string[]
  /** Só na entrega. */
  comparativo: { base: string | null; final: string; atraso: string } | null
  observacoes: string | null
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesExtenso = (anoMes: string) => `${MESES[Number(anoMes.slice(5, 7)) - 1]} de ${anoMes.slice(0, 4)}`
const ROTULO_TIPO: Record<TipoPeriodo, string> = { mensal: 'Relatório mensal', fase: 'Relatório de fase', entrega: 'Relatório de entrega' }

/**
 * PPC de cada semana avaliada do período, em ordem. A semana conta só se a data
 * de envio do semanal (sexta, ou antecipada por feriado) cai em [inicio, fim]:
 * nenhuma semana conta em dois meses.
 */
export function ppcSemanasDoPeriodo(
  planos: PlanoSemana[],
  inicio: string,
  fim: string,
  feriados: ReadonlySet<string>,
): { segunda: string; valor: number }[] {
  return planos
    .filter((pl) => {
      const envio = dataEnvioSemanal(pl.semanaInicio, feriados)
      return envio >= inicio && envio <= fim
    })
    .map((pl) => ({ segunda: pl.semanaInicio, valor: ppc(pl.itens) }))
    .filter((s): s is { segunda: string; valor: number } => s.valor !== null)
    .sort((a, b) => a.segunda.localeCompare(b.segunda))
}

export function montarConteudoPeriodo(p: {
  lado: Lado
  tipo: TipoPeriodo
  /** AAAA-MM (mensal) | `EtapaDaObra.referencia` (fase: menor numero da etapa) | 'entrega'. */
  referencia: string
  obra: ObraGrande
  inicio: string
  fim: string
  /** Data de referência: o fim, ou hoje se o período ainda não acabou. `obra` lida nela. */
  ref: string
  hoje: string
  planos: PlanoSemana[]
  restricoes: Restricao[]
  highlights: string[]
  observacoes: string | null
}): ConteudoPeriodo {
  const { lado, tipo, referencia, obra: og, inicio, fim, ref } = p
  const b = blocosDoPeriodo({ lado, obra: og, inicio, fim, ref, hoje: p.hoje, restricoes: p.restricoes })
  const interno = lado === 'interno'
  const etapas = etapasDaObra(og)

  const etapa = tipo === 'fase' ? etapas.find((e) => e.referencia === referencia) : undefined
  const nomePeriodo =
    tipo === 'mensal' ? mesExtenso(referencia) : tipo === 'fase' ? (etapa ? `etapa ${etapa.ordem} — ${etapa.nome}` : 'fase') : 'entrega da obra'
  const assunto = `${ROTULO_TIPO[tipo]} · ${b.loja} · ${nomePeriodo}${interno ? ' · interno' : ''}`
  const titulo = `${b.loja} — ${nomePeriodo}`
  const subtitulo = `Período de ${dataBr(inicio)} a ${dataBr(fim)}${ref < fim ? ` · dados até ${dataBr(ref)}` : ''}`

  // Curva S da data-base até a referência: semanal até ~6 meses, depois mensal.
  const atividades = og.calc?.atividades ?? []
  const dataBase = (og.obra.data_base as string | null | undefined) ?? null
  let curva: PontoCurva[] = []
  if (og.calc && atividades.length && dataBase && dataBase <= ref) {
    const passo = ms(ref) - ms(dataBase) > 183 * DIA_MS ? 'mes' : 'semana'
    const datas = datasDaCurva(dataBase, ref, passo)
    const prev = curvaPlanejada(atividades, datas, og.feriados)
    const base = og.calcBase ? curvaPlanejada(og.calcBase.atividades, datas, og.feriados) : null
    const real = new Map(curvaRealizada(atividades, og.hist, datas).map((s) => [s.data, s.valor]))
    curva = datas.map((d, i) => ({ data: d, base: base ? base[i].valor : null, previsto: prev[i].valor, realizado: real.get(d) ?? null }))
  }

  const marcos = etapas
    .filter((e) => e.concluida && e.fimReal! >= inicio && e.fimReal! <= fim)
    .sort((x, y) => x.fimReal!.localeCompare(y.fimReal!) || x.ordem - y.ordem)
    .map((e) => {
      const d = e.fimBase ? deltaDiasUteis(e.fimBase, e.fimReal!, og.feriados) : null
      return {
        etapa: `${e.ordem} — ${e.nome}`,
        base: e.fimBase ? dataBr(e.fimBase) : null,
        real: dataBr(e.fimReal!),
        desvio: d === null ? null : d === 0 ? 'no prazo da base' : d < 0 ? `${diasUteisTxt(-d)} antes da base` : `${diasUteisTxt(d)} depois da base`,
      }
    })

  const semanas = ppcSemanasDoPeriodo(p.planos, inicio, fim, og.feriados)
  const ppcMedio = semanas.length ? { valor: pct(semanas.reduce((s, x) => s + x.valor, 0) / semanas.length), semanas: semanas.length } : null

  let comparativo: ConteudoPeriodo['comparativo'] = null
  if (tipo === 'entrega') {
    const fimReal = atividades.length && atividades.every((a) => a.status === 'concluido' && a.fimReal) ? maxD(atividades.map((a) => a.fimReal!)) : null
    const final = fimReal ?? og.calc?.terminoProjetado ?? fim
    comparativo = {
      base: og.terminoBase ? dataBr(og.terminoBase) : null,
      final: dataBr(final),
      atraso: quebraDoAtraso(lado, og, ref) || 'sem atraso em relação à base',
    }
  }

  return {
    lado, tipo, referencia, loja: b.loja, assunto, titulo, subtitulo, inicio, fim,
    sinal: b.sinal,
    avanco: { ...b.avanco, ate: dataBr(ref) },
    previsao: b.previsao,
    curva, marcos,
    concluidas: b.concluidas, emAndamento: b.emAndamento,
    ppc: ppcMedio,
    doCliente: b.doCliente, impedimentos: b.impedimentos, ocultos: b.ocultos,
    highlights: p.highlights.map((h) => h.trim()).filter(Boolean),
    comparativo,
    observacoes: p.observacoes?.trim() || null,
  }
}

// ---- Validação do conteúdo congelado (entrada não confiável) ----------------

const SINAIS = (['verde', 'amarelo', 'vermelho'] as const).map((s) => sinalVisual(s))
const itemValido = (x: Campos) => strs(x, 'rotulo', 'corpo') && (x.tecnico === undefined || typeof x.tecnico === 'boolean')

/**
 * Campos da base comum (`blocosDoPeriodo`) com o formato exato: lado, textos,
 * sinal canônico (um dos três visuais), avanço, listas e cliente sem ocultos.
 */
export function blocosValidos(v: Campos, lado: Lado): boolean {
  if (v.lado !== lado || !strs(v, 'loja', 'assunto', 'titulo', 'subtitulo', 'previsao')) return false
  const s = v.sinal
  if (!obj(s) || !SINAIS.some((c) => (Object.keys(c) as (keyof SinalVisual)[]).every((k) => s[k] === c[k]) && Object.keys(s).length === Object.keys(c).length)) return false
  if (!obj(v.avanco) || !strs(v.avanco, 'previsto', 'realizado', 'desvio', 'ate')) return false
  if (!lista(v.concluidas, (x) => strs(x, 'descricao', 'fim'))) return false
  if (!lista(v.emAndamento, (x) => strs(x, 'descricao', 'percentual', 'termino'))) return false
  if (!lista(v.doCliente, (x) => strs(x, 'descricao', 'atividade', 'tipo') && strOuNull(x.prazo) && typeof x.vencida === 'boolean')) return false
  if (!lista(v.impedimentos, itemValido) || !lista(v.ocultos, itemValido)) return false
  if (lado === 'cliente' && (v.ocultos as unknown[]).length) return false
  return strOuNull(v.observacoes)
}

const TIPOS: TipoPeriodo[] = ['mensal', 'fase', 'entrega']
const REFERENCIA: Record<TipoPeriodo, RegExp> = { mensal: /^\d{4}-\d{2}$/, fase: /^\d+$/, entrega: /^entrega$/ }
// Fração finita e não negativa (sem teto: duração incoerente pode passar de 100% sem invalidar o congelado).
const fracao = (v: unknown) => nums(v) && (v as number) >= 0

/** true só se `v` tem o formato de ConteudoPeriodo do `lado` (e, se dados, do tipo/referência esperados). */
export function conteudoPeriodoValido(v: unknown, lado: Lado, esperado?: { tipo: TipoPeriodo; referencia: string }): v is ConteudoPeriodo {
  if (!obj(v) || !blocosValidos(v, lado)) return false
  const tipo = v.tipo as TipoPeriodo
  if (!TIPOS.includes(tipo) || !str(v.referencia) || !REFERENCIA[tipo].test(v.referencia)) return false
  if (esperado && (tipo !== esperado.tipo || v.referencia !== esperado.referencia)) return false
  if (!ISO.test(String(v.inicio)) || !ISO.test(String(v.fim))) return false
  if (!lista(v.curva, (x) => ISO.test(String(x.data)) && fracao(x.previsto) && (x.base === null || fracao(x.base)) && (x.realizado === null || fracao(x.realizado)))) return false
  if (!lista(v.marcos, (x) => strs(x, 'etapa', 'real') && strOuNull(x.base) && strOuNull(x.desvio))) return false
  const p = v.ppc
  if (p !== null && !(obj(p) && str(p.valor) && nums(p.semanas))) return false
  if (!Array.isArray(v.highlights) || !v.highlights.every(str)) return false
  const c = v.comparativo
  if (tipo === 'entrega' ? !(obj(c) && strOuNull(c.base) && strs(c, 'final', 'atraso')) : c !== null) return false
  return true
}
