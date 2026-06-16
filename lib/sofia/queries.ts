import { createClient } from '@/lib/supabase/server'
import type { Equipe, Veiculo, Motorista, KmDiario, Multa, Revisao } from './types'

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

export async function getKmHoje(): Promise<KmDiario[]> {
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
    .eq('status', 'pendente')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getRevisoesProximas(): Promise<Revisao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo, km_atual)')
    .order('km_ultima_revisao')
  return data ?? []
}
