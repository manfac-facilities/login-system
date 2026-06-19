import { createClient } from '@/lib/supabase/server'
import type {
  Equipe, Veiculo, Motorista, KmDiarioComRelacoes, Multa,
  Sinistro, Revisao, DocumentoVeiculo, Abastecimento,
  MotoristaDocumento, VeiculoResponsabilidadeHistorico, CentroCustoHistorico, Pendencia,
} from './types'

export async function getEquipes(): Promise<Equipe[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('equipes').select('*').order('codigo')
  return data ?? []
}

export async function getVeiculos(): Promise<Veiculo[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('veiculos').select('*').order('placa')
  return data ?? []
}

export async function getMotoristas(): Promise<Motorista[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('motoristas').select('*').order('nome')
  return data ?? []
}

export async function getMotoristasComCnhVencendo(): Promise<Motorista[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const em60dias = new Date()
  em60dias.setDate(em60dias.getDate() + 60)
  const limite = em60dias.toISOString().split('T')[0]
  const { data } = await supabase
    .from('motoristas')
    .select('*')
    .lte('cnh_vencimento', limite)
    .gte('cnh_vencimento', hoje)
    .eq('ativo', true)
    .order('cnh_vencimento')
  return data ?? []
}

export async function getKmHoje(): Promise<KmDiarioComRelacoes[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('km_diario')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .eq('data', hoje)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getMultasPendentes(): Promise<Multa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('multas')
    .select('*')
    .neq('status', 'descontada')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getSinistros(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sinistros')
    .select('*, veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getSinistrosAbertos(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sinistros')
    .select('*')
    .neq('status', 'encerrado')
  return data ?? []
}

export async function getRevisoes(veiculoId?: string): Promise<Revisao[]> {
  const supabase = await createClient()
  let query = supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo)')
    .order('data_realizada', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getRevisoesAtrasadas(): Promise<Revisao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('revisoes')
    .select('*')
    .order('created_at', { ascending: false })
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
  let query = supabase.from('documentos_veiculo').select('*, veiculos(placa)').order('vencimento')
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getDocumentosVencendo(diasLimite = 30): Promise<DocumentoVeiculo[]> {
  const supabase = await createClient()
  const limite = new Date()
  limite.setDate(limite.getDate() + diasLimite)
  const { data } = await supabase
    .from('documentos_veiculo')
    .select('*, veiculos(placa)')
    .lte('vencimento', limite.toISOString().split('T')[0])
  return data ?? []
}

export async function getAbastecimentos(veiculoId?: string): Promise<Abastecimento[]> {
  const supabase = await createClient()
  let query = supabase.from('abastecimentos').select('*, veiculos(placa)').order('data', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getMotoristaDocumentos(motoristaId: string): Promise<MotoristaDocumento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('motorista_documentos')
    .select('*')
    .eq('motorista_id', motoristaId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getResponsabilidadeHistorico(veiculoId: string): Promise<VeiculoResponsabilidadeHistorico[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('veiculo_responsabilidade_historico')
    .select('*, equipes(codigo), motoristas(nome)')
    .eq('veiculo_id', veiculoId)
    .order('inicio', { ascending: false })
  return data ?? []
}

export async function getCentroCustoHistorico(veiculoId: string): Promise<CentroCustoHistorico[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('centro_custo_historico')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .order('vigente_desde', { ascending: false })
  return data ?? []
}

export async function getPendenciasManuais(): Promise<Pendencia[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pendencias')
    .select('*')
    .order('prazo', { ascending: true })
  return data ?? []
}
