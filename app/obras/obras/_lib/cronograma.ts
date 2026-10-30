/**
 * Motor do cronograma da modalidade OBRA (spec §5.2, Eduardo §5, spec §7.1).
 * Puro: sem banco, sem React. Datas ISO `YYYY-MM-DD`, percentuais em fração 0–1.
 */
import { diasUteisEntre, proximoDiaUtil, somarDiasUteis } from './calendario'

export type StatusAtividade = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'bloqueado'
export type Responsavel = 'cliente' | 'manfac' | 'terceiro' | 'clima'
export type Situacao =
  | 'concluida'
  | 'bloqueada'
  | 'aguardando_cliente'
  | 'atrasada'
  | 'inicio_atrasado'
  | 'no_prazo'

export type AtividadePlano = {
  numero: number
  etapa: string
  descricao: string
  pred1: number | null
  pred2: number | null
  duracao: number
  bloqueiaPorTrava: boolean
  pesoValor: number
  /** Início digitado na versão (Leva 1). Ausente/null = segue as predecessoras. */
  inicioFixo?: string | null
}

export type AtividadeExec = {
  numero: number
  status: StatusAtividade
  percentual: number
  inicioReal: string | null
  fimReal: string | null
  /** Dias úteis restantes informados na atualização de status. Ausente/null = projeta pelo %. */
  diasRestantes?: number | null
  /** Data de status em que os dias restantes foram informados (âncora). Ausente/null = data de status/hoje. */
  diasRestantesEm?: string | null
}

export type ImpedimentoCalc = {
  atividadeNumero: number | null
  responsavel: Responsavel
  travaAtividade: boolean
  abertoEm: string
  encerradoEm: string | null
  impactoDias: number | null
}

export type AtividadeCalculada = AtividadePlano &
  AtividadeExec & {
    inicioPrevisto: string
    fimPrevisto: string
    inicioProjetado: string
    fimProjetado: string
    peso: number
    percentualPrevisto: number
    situacao: Situacao
    travada: boolean
    inicioFixo: string | null
    diasRestantes: number | null
    /** Ex.: 'Começa antes da atividade 5 terminar'. */
    alertaInicioFixo: string | null
    /** O início fixo caiu em folga e foi para o próximo dia útil. */
    inicioFixoAjustado: boolean
  }

export type ResultadoCronograma = {
  atividades: AtividadeCalculada[]
  previsto: number
  realizado: number
  desvioPP: number
  terminoPrevisto: string
  terminoProjetado: string
}

export type Sinal = 'verde' | 'amarelo' | 'vermelho'

export class CicloNasPredecessoras extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CicloNasPredecessoras'
  }
}

type Feriados = ReadonlySet<string>

const maxData = (datas: string[]): string => datas.reduce((m, d) => (d > m ? d : m))

function predecessoras(a: AtividadePlano, existentes: ReadonlySet<number>): number[] {
  return [a.pred1, a.pred2].filter((p): p is number => p !== null && existentes.has(p))
}

/** Ordem topológica (predecessoras antes). Lança CicloNasPredecessoras. */
function ordenar(plano: AtividadePlano[]): AtividadePlano[] {
  const porNumero = new Map(plano.map((a) => [a.numero, a]))
  const existentes = new Set(porNumero.keys())
  const estado = new Map<number, 'visitando' | 'feito'>()
  const ordem: AtividadePlano[] = []
  const visitar = (a: AtividadePlano, caminho: number[]) => {
    const e = estado.get(a.numero)
    if (e === 'feito') return
    if (e === 'visitando') {
      const ciclo = [...caminho.slice(caminho.indexOf(a.numero)), a.numero]
      throw new CicloNasPredecessoras(`Ciclo nas predecessoras: ${ciclo.join(' → ')}`)
    }
    estado.set(a.numero, 'visitando')
    for (const p of predecessoras(a, existentes)) visitar(porNumero.get(p)!, [...caminho, a.numero])
    estado.set(a.numero, 'feito')
    ordem.push(a)
  }
  for (const a of plano) visitar(a, [])
  return ordem
}

/** ceil sem ruído de ponto flutuante (10 × 0,3 = 3,0000000000000004 → 3, não 4). */
const ceilLimpo = (x: number) => Math.ceil(Math.round(x * 1e9) / 1e9)

export type CriterioPeso = 'valor' | 'duracao'

/**
 * Critério do peso do avanço (Leva 2 §3.4): o gravado na obra; sem ele (null,
 * coluna ausente ou valor desconhecido), valor se Σ peso_valor do plano > 0, senão duração.
 */
export function criterioEfetivo(pesoAvanco: unknown, plano: AtividadePlano[]): CriterioPeso {
  if (pesoAvanco === 'valor' || pesoAvanco === 'duracao') return pesoAvanco
  return plano.reduce((s, a) => s + a.pesoValor, 0) > 0 ? 'valor' : 'duracao'
}

export function calcularCronograma(p: {
  plano: AtividadePlano[]
  exec: AtividadeExec[]
  dataBase: string
  hoje: string
  /** Data de status da projeção (padrão `hoje`). */
  dataStatus?: string
  feriados: Feriados
  atividadeTrava: number | null
  impedimentos: ImpedimentoCalc[]
  /** Peso do avanço: `valor` (peso_valor, padrão) ou `duracao` (dias úteis planejados, mín. 1). */
  criterioPeso?: CriterioPeso
}): ResultadoCronograma {
  const { plano, dataBase, hoje, feriados, atividadeTrava } = p
  const dataStatus = p.dataStatus ?? hoje
  const ordem = ordenar(plano)
  const existentes = new Set(plano.map((a) => a.numero))
  const execPor = new Map(p.exec.map((e) => [e.numero, e]))
  const execDe = (n: number): AtividadeExec =>
    execPor.get(n) ?? { numero: n, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null }

  const pesoBruto = (a: AtividadePlano) => (p.criterioPeso === 'duracao' ? Math.max(a.duracao, 1) : a.pesoValor)
  const somaPeso = plano.reduce((s, a) => s + pesoBruto(a), 0)
  const travaAberta = atividadeTrava !== null && execDe(atividadeTrava).status !== 'concluido'
  const aguardandoCliente = new Set(
    p.impedimentos
      .filter((i) => i.encerradoEm === null && i.responsavel === 'cliente' && i.travaAtividade && i.atividadeNumero !== null)
      .map((i) => i.atividadeNumero as number),
  )
  const statusUtil = proximoDiaUtil(dataStatus, feriados)

  const calc = new Map<number, AtividadeCalculada>()
  for (const a of ordem) {
    const ex = execDe(a.numero)
    const preds = predecessoras(a, existentes).map((n) => calc.get(n)!)
    const dur = Math.max(a.duracao, 1)

    // Previsto: só plano e calendário. Início fixo manda e ignora as predecessoras.
    const inicioFixo = a.inicioFixo ?? null
    const diasRestantes = ex.diasRestantes ?? null
    let alertaInicioFixo: string | null = null
    let inicioPrevisto: string
    if (inicioFixo) {
      inicioPrevisto = proximoDiaUtil(inicioFixo, feriados)
      const conflito = preds.filter((x) => inicioPrevisto <= x.fimPrevisto)
      if (conflito.length) {
        const pior = conflito.reduce((m, x) => (x.fimPrevisto > m.fimPrevisto ? x : m))
        alertaInicioFixo = `Começa antes da atividade ${pior.numero} terminar`
      }
    } else {
      inicioPrevisto = preds.length
        ? somarDiasUteis(maxData(preds.map((x) => x.fimPrevisto)), 1, feriados)
        : proximoDiaUtil(dataBase, feriados)
    }
    const fimPrevisto = somarDiasUteis(inicioPrevisto, dur - 1, feriados)

    // Projetado: parte sempre do projetado das predecessoras.
    let inicioProjetado: string
    let fimProjetado: string
    const iniciada = ex.status === 'em_andamento' || (ex.status === 'bloqueado' && ex.inicioReal !== null)
    if (ex.status === 'concluido') {
      inicioProjetado = ex.inicioReal ?? inicioPrevisto
      fimProjetado = ex.fimReal ?? fimPrevisto
    } else if (iniciada) {
      inicioProjetado = ex.inicioReal ?? inicioPrevisto
      if (ex.status === 'em_andamento' && diasRestantes !== null) {
        // Âncora: a data de status em que os dias foram informados (spec §5 A5), não hoje.
        const ancora = ex.diasRestantesEm ?? dataStatus
        fimProjetado = diasRestantes === 0
          ? ancora
          : somarDiasUteis(proximoDiaUtil(ancora, feriados), ceilLimpo(diasRestantes) - 1, feriados)
      } else {
        const restante = Math.max(ceilLimpo(a.duracao * (1 - ex.percentual)), 1)
        fimProjetado = maxData([fimPrevisto, somarDiasUteis(statusUtil, restante - 1, feriados)])
      }
    } else {
      const candidatos = [inicioPrevisto]
      if (preds.length) candidatos.push(somarDiasUteis(maxData(preds.map((x) => x.fimProjetado)), 1, feriados))
      if (inicioPrevisto < dataStatus) candidatos.push(statusUtil)
      inicioProjetado = maxData(candidatos)
      fimProjetado = somarDiasUteis(inicioProjetado, dur - 1, feriados)
    }

    const percentualPrevisto =
      hoje < inicioPrevisto ? 0 : hoje >= fimPrevisto ? 1 : diasUteisEntre(inicioPrevisto, hoje, feriados) / dur

    let situacao: Situacao
    if (ex.status === 'concluido') situacao = 'concluida'
    else if (ex.status === 'bloqueado') situacao = 'bloqueada'
    else if (aguardandoCliente.has(a.numero)) situacao = 'aguardando_cliente'
    else if (hoje > fimPrevisto) situacao = 'atrasada'
    else if (hoje >= inicioPrevisto && ex.status === 'nao_iniciado') situacao = 'inicio_atrasado'
    else situacao = 'no_prazo'

    calc.set(a.numero, {
      ...a,
      ...ex,
      numero: a.numero,
      inicioPrevisto,
      fimPrevisto,
      inicioProjetado,
      fimProjetado,
      peso: somaPeso > 0 ? pesoBruto(a) / somaPeso : 0,
      percentualPrevisto,
      situacao,
      travada: a.bloqueiaPorTrava && travaAberta,
      inicioFixo,
      diasRestantes,
      alertaInicioFixo,
      inicioFixoAjustado: inicioFixo !== null && inicioFixo !== inicioPrevisto,
    })
  }

  // Mantém a ordem do plano na saída.
  const atividades = plano.map((a) => calc.get(a.numero)!)
  const previsto = atividades.reduce((s, a) => s + a.peso * a.percentualPrevisto, 0)
  const realizado = atividades.reduce((s, a) => s + a.peso * a.percentual, 0)
  const vazio = proximoDiaUtil(dataBase, feriados)
  return {
    atividades,
    previsto,
    realizado,
    desvioPP: Math.round((realizado - previsto) * 1000) / 10 || 0,
    terminoPrevisto: atividades.length ? maxData(atividades.map((a) => a.fimPrevisto)) : vazio,
    terminoProjetado: atividades.length ? maxData(atividades.map((a) => a.fimProjetado)) : vazio,
  }
}

export function podeIniciar(
  numero: number,
  plano: AtividadePlano[],
  exec: AtividadeExec[],
  atividadeTrava: number | null,
): { ok: true } | { ok: false; motivo: string } {
  const a = plano.find((x) => x.numero === numero)
  if (!a?.bloqueiaPorTrava || atividadeTrava === null) return { ok: true }
  const trava = exec.find((e) => e.numero === atividadeTrava)
  if (trava?.status === 'concluido') return { ok: true }
  return { ok: false, motivo: `Travada até a atividade ${atividadeTrava} ser concluída` }
}

export function diasDeImpacto(imps: ImpedimentoCalc[], hoje: string, feriados: Feriados): Record<Responsavel, number> {
  const r: Record<Responsavel, number> = { cliente: 0, manfac: 0, terceiro: 0, clima: 0 }
  for (const i of imps) {
    r[i.responsavel] += i.travaAtividade
      ? diasUteisEntre(i.abertoEm, i.encerradoEm ?? hoje, feriados)
      : (i.impactoDias ?? 0)
  }
  return r
}

export function atrasoPorResponsavel(p: {
  terminoBase: string
  terminoProjetado: string
  impacto: Record<Responsavel, number>
  feriados: Feriados
}): { total: number } & Record<Responsavel, number> {
  const total = Math.max(0, diasUteisEntre(p.terminoBase, p.terminoProjetado, p.feriados) - 1)
  let restante = total
  const parte = (r: Responsavel) => {
    const v = Math.min(restante, Math.max(p.impacto[r], 0))
    restante -= v
    return v
  }
  const cliente = parte('cliente')
  const clima = parte('clima')
  const terceiro = parte('terceiro')
  return { total, cliente, clima, terceiro, manfac: restante }
}

export function sinalDaObra(p: {
  desvioPP: number
  terminoProjetado: string
  terminoBase: string | null
  impedimentoClienteAberto: boolean
}): Sinal {
  if (p.desvioPP < -5 || (p.terminoBase !== null && p.terminoProjetado > p.terminoBase)) return 'vermelho'
  if (p.desvioPP < 0 || p.impedimentoClienteAberto) return 'amarelo'
  return 'verde'
}

export type ResumoEtapa = {
  etapa: string
  inicio: string
  fim: string
  diasUteis: number
  percentual: number
  inicioProjetado: string
  fimProjetado: string
  numeros: number[]
}

const minData = (datas: string[]): string => datas.reduce((m, d) => (d < m ? d : m))

/** Linhas-resumo por etapa, na ordem de aparição. % ponderado pelo peso; pela duração se a etapa soma peso 0. */
export function resumirEtapas(atividades: AtividadeCalculada[], feriados: Feriados): ResumoEtapa[] {
  const grupos = new Map<string, AtividadeCalculada[]>()
  for (const a of atividades) {
    const g = grupos.get(a.etapa)
    if (g) g.push(a)
    else grupos.set(a.etapa, [a])
  }
  return [...grupos].map(([etapa, as]) => {
    const somaPeso = as.reduce((s, a) => s + a.peso, 0)
    const pesoDe = (a: AtividadeCalculada) => (somaPeso > 0 ? a.peso : Math.max(a.duracao, 1))
    const total = as.reduce((s, a) => s + pesoDe(a), 0)
    const inicio = minData(as.map((a) => a.inicioPrevisto))
    const fim = maxData(as.map((a) => a.fimPrevisto))
    return {
      etapa,
      inicio,
      fim,
      diasUteis: diasUteisEntre(inicio, fim, feriados),
      percentual: total > 0 ? as.reduce((s, a) => s + pesoDe(a) * a.percentual, 0) / total : 0,
      inicioProjetado: minData(as.map((a) => a.inicioProjetado)),
      fimProjetado: maxData(as.map((a) => a.fimProjetado)),
      numeros: as.map((a) => a.numero),
    }
  })
}

export type ComparacaoBase = {
  numero: number
  inicioBase: string | null
  fimBase: string | null
  deltaDias: number | null
}

/** Dias úteis de `de` até `ate`, sem contar `de`: positivo se `ate` é depois, negativo se antes, 0 igual. */
export function deltaDiasUteis(de: string, ate: string, feriados: Feriados): number {
  if (ate === de) return 0
  return ate > de ? diasUteisEntre(de, ate, feriados) - 1 : -(diasUteisEntre(ate, de, feriados) - 1)
}

/** Δ do fim projetado (vigente) vs fim previsto da base, por atividade. */
export function compararComBase(
  vigente: AtividadeCalculada[],
  base: AtividadeCalculada[] | null,
  feriados: Feriados,
): Map<number, ComparacaoBase> {
  const basePor = new Map((base ?? []).map((b) => [b.numero, b]))
  return new Map(
    vigente.map((a) => {
      const b = basePor.get(a.numero)
      const c: ComparacaoBase = b
        ? { numero: a.numero, inicioBase: b.inicioPrevisto, fimBase: b.fimPrevisto, deltaDias: deltaDiasUteis(b.fimPrevisto, a.fimProjetado, feriados) }
        : { numero: a.numero, inicioBase: null, fimBase: null, deltaDias: null }
      return [a.numero, c]
    }),
  )
}

/** Duração (dias úteis inclusivos, mín. 1) a partir do Fim digitado. */
export function duracaoPorFim(inicio: string, fim: string, feriados: Feriados): number {
  if (fim < inicio) throw new Error(`Fim antes do início (${inicio.slice(8, 10)}/${inicio.slice(5, 7)})`)
  return Math.max(diasUteisEntre(inicio, fim, feriados), 1)
}
