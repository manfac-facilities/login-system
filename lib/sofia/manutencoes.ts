/**
 * Manutenção corretiva — regra pura (sem banco). Spec 2026-11-03 §3; textos do mockup aprovado.
 */
export type ManutencaoStatus = 'aguardando_orcamento' | 'aguardando_aprovacao' | 'em_conserto' | 'concluida'
export type QuemArca = 'locadora' | 'empresa' | 'motorista'

export const STATUS_LBL: Record<ManutencaoStatus, string> = {
  aguardando_orcamento: 'Aguardando orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_conserto: 'Em conserto',
  concluida: 'Concluída',
}
export const ARCA_LBL: Record<QuemArca, string> = {
  locadora: 'Locadora',
  empresa: 'Empresa',
  motorista: 'Motorista (mau uso)',
}
export const STATUS_ABERTURA: ManutencaoStatus[] = ['aguardando_orcamento', 'aguardando_aprovacao', 'em_conserto']
export const QUEM_ARCA: QuemArca[] = ['locadora', 'empresa', 'motorista']

const PROXIMO: Partial<Record<ManutencaoStatus, { para: ManutencaoStatus; rotulo: string }>> = {
  aguardando_orcamento: { para: 'aguardando_aprovacao', rotulo: 'Orçamento recebido: aguardando aprovação' },
  aguardando_aprovacao: { para: 'em_conserto', rotulo: 'Aprovado: carro em conserto' },
}

export function proximoStatus(atual: string): { para: ManutencaoStatus; rotulo: string } | null {
  return PROXIMO[atual as ManutencaoStatus] ?? null
}

export interface ManutencaoBase {
  placa: string
  data_entrada: string
  data_saida: string | null
  custo: number | null
  status: ManutencaoStatus
  tirou_da_equipe: boolean
}

const DIA = 86400000
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / DIA)

/** (saída real ou hoje) − entrada + 1; nunca menos que 1. */
export function diasParados(m: Pick<ManutencaoBase, 'data_entrada' | 'data_saida'>, hoje: string): number {
  return Math.max(0, dias(m.data_entrada, m.data_saida ?? hoje)) + 1
}

/** Dias parados por placa no mês `AAAA-MM` (só as que tiraram o carro), recortados ao mês e a hoje. */
export function diasParadosNoMes(lista: ManutencaoBase[], mes: string, hoje: string): { placa: string; dias: number }[] {
  const ini = `${mes}-01`
  const [a, mm] = mes.split('-').map(Number)
  const fimMes = new Date(Date.UTC(a, mm, 0)).toISOString().slice(0, 10)
  const por = new Map<string, number>()
  for (const m of lista) {
    if (!m.tirou_da_equipe) continue
    const de = m.data_entrada > ini ? m.data_entrada : ini
    const saida = m.data_saida ?? hoje
    const ate = [saida, fimMes, hoje].sort()[0]
    if (ate < de) continue
    por.set(m.placa, (por.get(m.placa) ?? 0) + dias(de, ate) + 1)
  }
  return [...por.entries()].map(([placa, d]) => ({ placa, dias: d })).sort((x, y) => y.dias - x.dias || x.placa.localeCompare(y.placa))
}

/** Cartões da tela de corretiva. `carrosParados` = veículos com status `manutencao` (contado fora). */
export function cartoesCorretiva(lista: ManutencaoBase[], carrosParados: number, hoje: string) {
  const abertas = lista.filter((m) => m.status !== 'concluida')
  const mes = hoje.slice(0, 7)
  const doMes = lista.filter((m) => m.data_entrada.startsWith(mes) && m.custo != null)
  return {
    emAberto: abertas.length,
    comCarroParado: abertas.filter((m) => m.tirou_da_equipe).length,
    custoMes: Math.round(doMes.reduce((s, m) => s + Number(m.custo), 0) * 100) / 100,
    servicosComValor: doMes.length,
    carrosParados,
  }
}

export function validarAbertura(f: { veiculo_id: string; defeito: string; data_entrada: string; saida_prevista: string }): string | null {
  if (!f.veiculo_id) return 'Escolha o veículo.'
  if (!f.defeito.trim()) return 'Descreva o defeito.'
  if (!f.data_entrada) return 'Informe a data de entrada.'
  if (f.saida_prevista && f.saida_prevista < f.data_entrada) return 'A saída prevista não pode ser antes da entrada.'
  return null
}

export function validarConclusao(
  f: { data_saida: string; custo: string; quem_arca: string },
  entrada: { data_entrada: string }
): string | null {
  if (!f.data_saida) return 'Informe a saída real.'
  const custo = f.custo.trim() === '' ? NaN : Number(f.custo)
  if (!Number.isFinite(custo) || custo < 0) return 'Informe o custo final (pode ser zero).'
  if (!QUEM_ARCA.includes(f.quem_arca as QuemArca)) return 'Informe quem arca com o custo.'
  if (f.data_saida < entrada.data_entrada) return 'A saída real não pode ser antes da entrada.'
  return null
}

/** O anexo só pode morar em `manutencoes/<id>/<arquivo>` (sem subpasta, sem `..`). */
export function caminhoAnexoValido(id: string, path: string): boolean {
  if (!id || id.includes('/') || path.includes('..') || path.includes('\\')) return false
  const prefixo = `manutencoes/${id}/`
  if (!path.startsWith(prefixo)) return false
  const nome = path.slice(prefixo.length)
  return nome.length > 0 && !nome.includes('/')
}
