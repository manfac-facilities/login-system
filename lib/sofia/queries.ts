import { createClient } from '@/lib/supabase/server'
import type {
  Equipe, Veiculo, Motorista, KmDiarioComRelacoes, Multa,
  Sinistro, Revisao, DocumentoVeiculo, Abastecimento,
  MotoristaDocumento, VeiculoResponsabilidadeHistorico, CentroCustoHistorico, Pendencia, Checklist,
  KmExcedidoDesconto,
} from './types'

/**
 * Loga o erro do Supabase com o nome da função de origem e propaga uma
 * exceção com mensagem amigável (achado B-08 da auditoria). Antes, toda
 * função engolia o erro e retornava `[]`, o que fazia uma falha de RLS/timeout
 * aparecer como "lista vazia" — indistinguível de "não há registros" para quem
 * opera o sistema. Agora a falha é logada no servidor e propagada para o error
 * boundary de `/sofia` (app/(operacoes)/sofia/error.tsx).
 */
function throwQueryError(fn: string, error: unknown): never {
  console.error(`[sofia/queries] ${fn} falhou:`, error)
  throw new Error('Erro ao carregar dados do sistema. Recarregue a página; se persistir, avise o suporte.')
}

export async function getEquipes(): Promise<Equipe[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipes').select('*').order('codigo')
  if (error) throwQueryError('getEquipes', error)
  return data ?? []
}

export async function getVeiculos(): Promise<Veiculo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('veiculos').select('*').order('placa')
  if (error) throwQueryError('getVeiculos', error)
  return data ?? []
}

export async function getMotoristas(): Promise<Motorista[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('motoristas').select('*').order('nome')
  if (error) throwQueryError('getMotoristas', error)
  return data ?? []
}

export async function getMotoristasComCnhVencendo(): Promise<Motorista[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const em60dias = new Date()
  em60dias.setDate(em60dias.getDate() + 60)
  const limite = em60dias.toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('motoristas')
    .select('*')
    .lte('cnh_vencimento', limite)
    .gte('cnh_vencimento', hoje)
    .eq('ativo', true)
    .order('cnh_vencimento')
  if (error) throwQueryError('getMotoristasComCnhVencendo', error)
  return data ?? []
}

export async function getKmHoje(): Promise<KmDiarioComRelacoes[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('km_diario')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .eq('data', hoje)
    .order('created_at', { ascending: false })
  if (error) throwQueryError('getKmHoje', error)
  return data ?? []
}

export async function getMultasPendentes(): Promise<Multa[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('multas')
    .select('*')
    .neq('status', 'descontada')
    .order('data', { ascending: false })
  if (error) throwQueryError('getMultasPendentes', error)
  return data ?? []
}

export async function getSinistros(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sinistros')
    .select('*, veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })
  if (error) throwQueryError('getSinistros', error)
  return data ?? []
}

export async function getSinistrosAbertos(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sinistros')
    .select('*')
    .neq('status', 'encerrado')
  if (error) throwQueryError('getSinistrosAbertos', error)
  return data ?? []
}

export async function getRevisoes(veiculoId?: string): Promise<Revisao[]> {
  const supabase = await createClient()
  let query = supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo), motoristas(nome)')
    .order('data_realizada', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data, error } = await query
  if (error) throwQueryError('getRevisoes', error)
  return data ?? []
}

export async function getRevisoesAtrasadas(): Promise<Revisao[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('revisoes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throwQueryError('getRevisoesAtrasadas', error)
  const hoje = new Date().toISOString().split('T')[0]
  const maisRecentePorVeiculoETipo = new Map<string, Revisao>()
  for (const r of data ?? []) {
    const chave = `${r.veiculo_id}::${r.tipo}`
    if (!maisRecentePorVeiculoETipo.has(chave)) maisRecentePorVeiculoETipo.set(chave, r)
  }
  return Array.from(maisRecentePorVeiculoETipo.values()).filter(
    (r) => r.proxima_data != null && r.proxima_data < hoje
  )
}

export async function getDocumentosVeiculo(veiculoId?: string): Promise<DocumentoVeiculo[]> {
  const supabase = await createClient()
  let query = supabase.from('documentos_veiculo').select('*, veiculos(placa, modelo)').order('vencimento')
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data, error } = await query
  if (error) throwQueryError('getDocumentosVeiculo', error)
  return data ?? []
}

export async function getDocumentosVencendo(diasLimite = 30): Promise<DocumentoVeiculo[]> {
  const supabase = await createClient()
  const limite = new Date()
  limite.setDate(limite.getDate() + diasLimite)
  const { data, error } = await supabase
    .from('documentos_veiculo')
    .select('*, veiculos(placa)')
    .lte('vencimento', limite.toISOString().split('T')[0])
  if (error) throwQueryError('getDocumentosVencendo', error)
  return data ?? []
}

export async function getAbastecimentos(veiculoId?: string): Promise<Abastecimento[]> {
  const supabase = await createClient()
  let query = supabase.from('abastecimentos').select('*, veiculos(placa)').order('data', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data, error } = await query
  if (error) throwQueryError('getAbastecimentos', error)
  return data ?? []
}

export async function getMotoristaDocumentos(motoristaId: string): Promise<MotoristaDocumento[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('motorista_documentos')
    .select('*')
    .eq('motorista_id', motoristaId)
    .order('created_at', { ascending: false })
  if (error) throwQueryError('getMotoristaDocumentos', error)
  return data ?? []
}

export async function getResponsabilidadeHistorico(veiculoId: string): Promise<VeiculoResponsabilidadeHistorico[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('veiculo_responsabilidade_historico')
    .select('*, equipes(codigo), motoristas(nome)')
    .eq('veiculo_id', veiculoId)
    .order('inicio', { ascending: false })
  if (error) throwQueryError('getResponsabilidadeHistorico', error)
  return data ?? []
}

export async function getCentroCustoHistorico(veiculoId: string): Promise<CentroCustoHistorico[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('centro_custo_historico')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .order('vigente_desde', { ascending: false })
  if (error) throwQueryError('getCentroCustoHistorico', error)
  return data ?? []
}

export async function getPendenciasManuais(): Promise<Pendencia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pendencias')
    .select('*')
    .order('prazo', { ascending: true })
  if (error) throwQueryError('getPendenciasManuais', error)
  return data ?? []
}

export async function getResponsabilidadesAtuais(): Promise<VeiculoResponsabilidadeHistorico[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('veiculo_responsabilidade_historico')
    .select('*')
    .is('fim', null)
  if (error) throwQueryError('getResponsabilidadesAtuais', error)
  return data ?? []
}

export async function getChecklistsRecentes(): Promise<Checklist[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throwQueryError('getChecklistsRecentes', error)
  return data ?? []
}

export async function getKmExcedidoDescontos(): Promise<KmExcedidoDesconto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('km_excedido_desconto').select('*')
  if (error) throwQueryError('getKmExcedidoDescontos', error)
  return (data ?? []) as KmExcedidoDesconto[]
}

export async function getKmDiarioHistorico(): Promise<KmDiarioComRelacoes[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('km_diario')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })
  if (error) throwQueryError('getKmDiarioHistorico', error)
  return data ?? []
}

export async function getAbastecimentoHistorico(): Promise<
  (Abastecimento & { veiculos: { placa: string } | null })[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('abastecimentos')
    .select('*, veiculos(placa)')
    .order('data', { ascending: false })
  if (error) throwQueryError('getAbastecimentoHistorico', error)
  return (data ?? []) as (Abastecimento & { veiculos: { placa: string } | null })[]
}

export interface KmResumoMensal {
  mes: string
  equipe_codigo: string
  veiculo_placa: string
  veiculo_id: string
  km_contratual_mensal: number | null
  km_inicio: number
  km_fim: number
  km_rodados: number
}

export async function getKmResumoMensal(): Promise<KmResumoMensal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('km_diario')
    .select('data, km_atual, veiculo_id, equipes(codigo), veiculos(placa, km_contratual_mensal)')
    .order('data', { ascending: true })

  if (error) throwQueryError('getKmResumoMensal', error)
  if (!data) return []

  type Row = {
    data: string
    km_atual: number
    veiculo_id: string
    equipes: { codigo: string } | null
    veiculos: { placa: string; km_contratual_mensal: number | null } | null
  }
  const rows = data as unknown as Row[]

  // Group by (veiculo_id, mes)
  const groups = new Map<string, {
    km_inicio: number; km_fim: number; equipe_codigo: string
    veiculo_placa: string; veiculo_id: string; km_contratual_mensal: number | null; mes: string
  }>()

  for (const row of rows) {
    const mes = row.data.slice(0, 7)
    const key = `${row.veiculo_id}::${mes}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        mes,
        equipe_codigo: row.equipes?.codigo ?? '—',
        veiculo_placa: row.veiculos?.placa ?? '—',
        veiculo_id: row.veiculo_id,
        km_contratual_mensal: row.veiculos?.km_contratual_mensal ?? null,
        km_inicio: row.km_atual,
        km_fim: row.km_atual,
      })
    } else {
      existing.km_fim = row.km_atual
    }
  }

  return Array.from(groups.values())
    .map((g) => ({ ...g, km_rodados: g.km_fim - g.km_inicio }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
}
