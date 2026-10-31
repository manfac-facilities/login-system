/**
 * Agenda de comunicação da OBRA (Leva 4 §2.2, SGO literal). Pura: calculada do
 * cronograma vigente + envios já feitos; nada gravado.
 *
 * "diários: cada dia útil de dataBase até a previsão de término; semanais: cada
 * sexta a partir da primeira sexta ≥ dataBase, até término + 7 dias, antecipando
 * se for feriado; mensais: último dia útil de cada mês até o mês do término; de
 * fase: maior fimPrevisto de cada etapa; de entrega: previsão de término."
 *
 * O envio casa com o item por tipo + referência (diário = data; semanal =
 * segunda; mensal = AAAA-MM; fase = ordem da etapa; entrega = 'entrega'), então
 * o item não duplica quando o cronograma muda; envio sem item calculado (etapa
 * que sumiu, semana fora do novo término) continua na agenda — envio feito não
 * se apaga. Fase de etapa não concluída fica sempre Programado (o relatório só
 * existe depois da conclusão).
 *
 * Quem monta `envios` (só lado cliente): diário/semanal pela data de
 * `obras_envio.referencia`; mensal/fase/entrega pela `obras_relatorio.referencia`
 * do `relatorio_id` (a coluna do envio é date e não serve a esses tipos).
 */
import { ehDiaUtil } from './calendario'
import { dataEnvioSemanal, segundaDaSemana } from './last-planner'

export type TipoAgenda = 'diario' | 'semanal' | 'mensal' | 'fase' | 'entrega'
export type SituacaoAgenda = 'no_prazo' | 'com_atraso' | 'atrasado' | 'enviar_hoje' | 'programado'
export type ItemAgenda = {
  tipo: TipoAgenda
  referencia: string
  dataPrevista: string
  /** Data (America/Sao_Paulo) do primeiro envio; null = não enviado. */
  dataReal: string | null
  situacao: SituacaoAgenda
}
export type EtapaAgenda = { ordem: number; nome: string; fimPrevisto: string; concluida: boolean }
export type EnvioAgenda = { tipo: string; referencia: string | null; enviadoEm: string }

const DIA_MS = 86_400_000
const ms = (d: string) => {
  const [a, m, x] = d.split('-').map(Number)
  return Date.UTC(a, m - 1, x)
}
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const somar = (d: string, n: number) => iso(ms(d) + n * DIA_MS)
const ISO = /^\d{4}-\d{2}-\d{2}$/
const ANO_MES = /^\d{4}-\d{2}$/
const ORDEM: TipoAgenda[] = ['diario', 'semanal', 'mensal', 'fase', 'entrega']
const TIPOS = new Set<string>(ORDEM)

/** Último dia útil (seg–sex, fora feriados) do mês `AAAA-MM`. */
export function ultimoDiaUtilDoMes(anoMes: string, feriados: ReadonlySet<string>): string {
  const [a, m] = anoMes.split('-').map(Number)
  let t = Date.UTC(a, m, 0)
  while (!ehDiaUtil(iso(t), feriados)) t -= DIA_MS
  return iso(t)
}

/** Período do mensal: do 1º dia do mês (ou da data-base, se for depois) ao último dia útil. */
export function periodoMensal(anoMes: string, dataBase: string, feriados: ReadonlySet<string>): { inicio: string; fim: string } {
  const primeiro = `${anoMes}-01`
  return { inicio: dataBase > primeiro ? dataBase : primeiro, fim: ultimoDiaUtilDoMes(anoMes, feriados) }
}

/** Data civil em São Paulo do timestamp (data pura passa direto). */
const dataSp = (ts: string): string =>
  ISO.test(ts) ? ts : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts))

/** Data prevista "natural" de um envio sem item calculado (null = sem como calcular). */
function dataNatural(tipo: TipoAgenda, ref: string, feriados: ReadonlySet<string>): string | null {
  if (tipo === 'diario') return ISO.test(ref) ? ref : null
  if (tipo === 'semanal') return ISO.test(ref) ? dataEnvioSemanal(segundaDaSemana(ref), feriados) : null
  if (tipo === 'mensal') return ANO_MES.test(ref) ? ultimoDiaUtilDoMes(ref, feriados) : null
  return null
}

export function agendaDaObra(p: {
  /** null = base ainda não salva: só os envios já feitos. */
  dataBase: string | null
  /** Previsão de término do cronograma vigente. */
  terminoPrevisto: string | null
  etapas: EtapaAgenda[]
  feriados: ReadonlySet<string>
  envios: EnvioAgenda[]
  hojeIso: string
}): ItemAgenda[] {
  const { dataBase, terminoPrevisto: fim, feriados, hojeIso: hoje } = p
  const previstos: { tipo: TipoAgenda; referencia: string; dataPrevista: string; disponivel: boolean }[] = []
  const add = (tipo: TipoAgenda, referencia: string, dataPrevista: string, disponivel = true) =>
    previstos.push({ tipo, referencia, dataPrevista, disponivel })

  if (dataBase && fim && dataBase <= fim) {
    for (let d = dataBase; d <= fim; d = somar(d, 1)) if (ehDiaUtil(d, feriados)) add('diario', d, d)

    let sexta = dataBase
    while (new Date(ms(sexta)).getUTCDay() !== 5) sexta = somar(sexta, 1)
    for (const limite = somar(fim, 7); sexta <= limite; sexta = somar(sexta, 7)) {
      const segunda = somar(sexta, -4)
      add('semanal', segunda, dataEnvioSemanal(segunda, feriados))
    }

    for (let mes = dataBase.slice(0, 7); mes <= fim.slice(0, 7); ) {
      const data = ultimoDiaUtilDoMes(mes, feriados)
      if (data >= dataBase) add('mensal', mes, data)
      const [a, m] = mes.split('-').map(Number)
      mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
    }
  }
  if (dataBase) {
    for (const e of p.etapas) add('fase', String(e.ordem), e.fimPrevisto, e.concluida)
    if (fim) add('entrega', 'entrega', fim)
  }

  // Primeiro envio de cada (tipo, referência).
  const enviado = new Map<string, string>()
  for (const e of p.envios) {
    if (!TIPOS.has(e.tipo) || !e.referencia) continue
    const k = `${e.tipo}|${e.referencia}`
    const d = dataSp(e.enviadoEm)
    if (!enviado.has(k) || d < enviado.get(k)!) enviado.set(k, d)
  }

  const situacao = (dataPrevista: string, dataReal: string | null, disponivel: boolean): SituacaoAgenda =>
    dataReal
      ? dataReal <= dataPrevista ? 'no_prazo' : 'com_atraso'
      : !disponivel || dataPrevista > hoje ? 'programado' : dataPrevista === hoje ? 'enviar_hoje' : 'atrasado'

  const out: ItemAgenda[] = previstos.map((i) => {
    const dataReal = enviado.get(`${i.tipo}|${i.referencia}`) ?? null
    return { tipo: i.tipo, referencia: i.referencia, dataPrevista: i.dataPrevista, dataReal, situacao: situacao(i.dataPrevista, dataReal, i.disponivel) }
  })
  // Envio sem item calculado: continua na agenda.
  const calculados = new Set(previstos.map((i) => `${i.tipo}|${i.referencia}`))
  for (const [k, dataReal] of enviado) {
    if (calculados.has(k)) continue
    const [tipo, referencia] = k.split('|') as [TipoAgenda, string]
    const dataPrevista = dataNatural(tipo, referencia, feriados) ?? dataReal
    out.push({ tipo, referencia, dataPrevista, dataReal, situacao: situacao(dataPrevista, dataReal, true) })
  }
  return out.sort(
    (a, b) => a.dataPrevista.localeCompare(b.dataPrevista) || ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || a.referencia.localeCompare(b.referencia, undefined, { numeric: true }),
  )
}
