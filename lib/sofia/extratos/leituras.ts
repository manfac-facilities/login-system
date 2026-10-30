import { createClient } from '@/lib/supabase/server'
import type { Ligacao, LinhaSemCC } from './agrupar'

/**
 * Leituras das telas de extratos. Tudo passa pela RLS do Sofia (quem tem
 * acesso ao Sofia lê; D2). Falha vira erro, nunca lista vazia silenciosa.
 */

const LOTE = 1000 // limite padrão de linhas por consulta do PostgREST

export type Equipe = { id: string; codigo: string }
export type CentroCusto = { equipe_id: string; codigo: string; nome: string; vigente_desde: string; criado_em: string }
export type LigacaoRow = Ligacao & { id: string }
export type Gasto = LinhaSemCC & {
  id: string
  hora_uso: string | null
  servico: string | null
  tipo_movimento: string | null
  litros: number | null
  valor_litro: number | null
  estabelecimento: string | null
  cidade: string | null
  placa: string | null
  equipe_codigo: string | null
  centro_custo_codigo: string | null
  centro_custo_nome: string | null
}
export type Envio = {
  id: string
  plataforma: string
  arquivo_nome: string
  enviado_por: string
  enviado_em: string
  linhas_novas: number
  linhas_existentes: number
  sem_centro_custo: number
  periodo_inicio: string
  periodo_fim: string
  saldo: number | null
}

function falha(fn: string, error: { message?: string }): never {
  throw new Error(`${fn}: ${error.message ?? 'erro'}`)
}

export async function getEquipesExtrato(): Promise<Equipe[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipes').select('id, codigo').order('codigo')
  if (error) falha('getEquipesExtrato', error)
  return data ?? []
}

export async function getLigacoes(plataforma: 'ticketlog' | 'veloe'): Promise<LigacaoRow[]> {
  const supabase = await createClient()
  const out: LigacaoRow[] = []
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await supabase
      .from('sofia_extrato_ligacoes')
      .select('id, plataforma, identificador, equipe_id, vigente_desde, criado_em')
      .eq('plataforma', plataforma)
      .order('id')
      .range(de, de + LOTE - 1)
    if (error) falha('getLigacoes', error)
    out.push(...(data ?? []))
    if ((data ?? []).length < LOTE) return out
  }
}

export async function getCentrosCusto(): Promise<CentroCusto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sofia_equipe_centro_custo')
    .select('equipe_id, codigo, nome, vigente_desde, criado_em')
  if (error) falha('getCentrosCusto', error)
  return data ?? []
}

export type FiltroGastos = {
  plataforma?: 'ticketlog' | 'veloe'
  equipeId?: string
  /** código do Omie, ou '__none' para só os sem centro de custo */
  centroCusto?: string
  de?: string
  ate?: string
  soSemCentroCusto?: boolean
}

/** Todas as linhas do filtro (paginando por baixo), mais recentes primeiro. */
export async function getGastos(f: FiltroGastos = {}): Promise<Gasto[]> {
  const supabase = await createClient()
  const out: Gasto[] = []
  for (let de = 0; ; de += LOTE) {
    let q = supabase
      .from('sofia_extrato_consumo')
      .select(
        'id, plataforma, identificador, data_uso, hora_uso, valor, servico, tipo_movimento, litros, valor_litro, estabelecimento, cidade, placa, equipe_id, equipe_codigo, centro_custo_codigo, centro_custo_nome, motivo_sem_centro_custo'
      )
    if (f.plataforma) q = q.eq('plataforma', f.plataforma)
    if (f.equipeId) q = q.eq('equipe_id', f.equipeId)
    if (f.centroCusto === '__none' || f.soSemCentroCusto) q = q.not('motivo_sem_centro_custo', 'is', null)
    else if (f.centroCusto) q = q.eq('centro_custo_codigo', f.centroCusto)
    if (f.de) q = q.gte('data_uso', f.de)
    if (f.ate) q = q.lte('data_uso', f.ate)
    const { data, error } = await q
      .order('data_uso', { ascending: false })
      .order('hora_uso', { ascending: false })
      .order('id')
      .range(de, de + LOTE - 1)
    if (error) falha('getGastos', error)
    out.push(...((data ?? []) as Gasto[]))
    if ((data ?? []).length < LOTE) return out
  }
}

/** Envios com o saldo que a pessoa digitou (D2: visível a todo o Frotas). */
export async function getEnvios(): Promise<Envio[]> {
  const supabase = await createClient()
  const [envios, saldos] = await Promise.all([
    supabase
      .from('sofia_extrato_envios')
      .select('id, plataforma, arquivo_nome, enviado_por, enviado_em, linhas_novas, linhas_existentes, sem_centro_custo, periodo_inicio, periodo_fim')
      .order('enviado_em', { ascending: false })
      .limit(200),
    supabase.from('sofia_extrato_saldos').select('envio_id, valor').limit(1000),
  ])
  if (envios.error) falha('getEnvios', envios.error)
  if (saldos.error) falha('getEnvios', saldos.error)
  const saldoDe = new Map((saldos.data ?? []).map((s) => [s.envio_id as string, Number(s.valor)]))
  return (envios.data ?? []).map((e) => ({ ...e, saldo: saldoDe.get(e.id) ?? null })) as Envio[]
}

/** Data de hoje em São Paulo (AAAA-MM-DD): vigência é por dia civil, não por UTC. */
export function hojeSP(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Centro de custo vigente de uma equipe numa data (mesma regra da view: vigente_desde, depois criado_em). */
export function centroCustoVigente(centros: CentroCusto[], equipeId: string, data: string): CentroCusto | null {
  let r: CentroCusto | null = null
  for (const c of centros) {
    if (c.equipe_id !== equipeId || c.vigente_desde > data) continue
    if (!r || c.vigente_desde > r.vigente_desde || (c.vigente_desde === r.vigente_desde && c.criado_em > r.criado_em)) r = c
  }
  return r
}

export const rotuloCentroCusto = (c: CentroCusto | null) => (c ? `${c.codigo} - ${c.nome}` : null)

/** Equipes com o centro de custo de hoje, para os seletores dos diálogos. */
export async function getOpcoesEquipe() {
  const [equipes, centros] = await Promise.all([getEquipesExtrato(), getCentrosCusto()])
  const hoje = hojeSP()
  return equipes.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    centroCusto: rotuloCentroCusto(centroCustoVigente(centros, e.id, hoje)),
  }))
}
