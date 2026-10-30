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
}

export type AtividadeExec = {
  numero: number
  status: StatusAtividade
  percentual: number
  inicioReal: string | null
  fimReal: string | null
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

export function calcularCronograma(p: {
  plano: AtividadePlano[]
  exec: AtividadeExec[]
  dataBase: string
  hoje: string
  feriados: Feriados
  atividadeTrava: number | null
  impedimentos: ImpedimentoCalc[]
}): ResultadoCronograma {
  const { plano, dataBase, hoje, feriados, atividadeTrava } = p
  const ordem = ordenar(plano)
  const existentes = new Set(plano.map((a) => a.numero))
  const execPor = new Map(p.exec.map((e) => [e.numero, e]))
  const execDe = (n: number): AtividadeExec =>
    execPor.get(n) ?? { numero: n, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null }

  const somaPeso = plano.reduce((s, a) => s + a.pesoValor, 0)
  const travaAberta = atividadeTrava !== null && execDe(atividadeTrava).status !== 'concluido'
  const aguardandoCliente = new Set(
    p.impedimentos
      .filter((i) => i.encerradoEm === null && i.responsavel === 'cliente' && i.travaAtividade && i.atividadeNumero !== null)
      .map((i) => i.atividadeNumero as number),
  )
  const hojeUtil = proximoDiaUtil(hoje, feriados)

  const calc = new Map<number, AtividadeCalculada>()
  for (const a of ordem) {
    const ex = execDe(a.numero)
    const preds = predecessoras(a, existentes).map((n) => calc.get(n)!)
    const dur = Math.max(a.duracao, 1)

    // Previsto: só plano e calendário.
    const inicioPrevisto = preds.length
      ? somarDiasUteis(maxData(preds.map((x) => x.fimPrevisto)), 1, feriados)
      : proximoDiaUtil(dataBase, feriados)
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
      const restante = Math.max(ceilLimpo(a.duracao * (1 - ex.percentual)), 1)
      fimProjetado = maxData([fimPrevisto, somarDiasUteis(hojeUtil, restante - 1, feriados)])
    } else {
      const candidatos = [inicioPrevisto]
      if (preds.length) candidatos.push(somarDiasUteis(maxData(preds.map((x) => x.fimProjetado)), 1, feriados))
      if (inicioPrevisto < hoje) candidatos.push(hojeUtil)
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
      peso: somaPeso > 0 ? a.pesoValor / somaPeso : 0,
      percentualPrevisto,
      situacao,
      travada: a.bloqueiaPorTrava && travaAberta,
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
