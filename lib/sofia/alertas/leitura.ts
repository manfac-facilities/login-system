/**
 * Leitura dos dados do e-mail diário. Roda no servidor com o cliente admin (a rota é protegida por
 * segredo; não há usuário logado). Qualquer erro de leitura propaga — a rota manda o aviso de falha.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { diaUtilAnterior, type EntradaAlertas } from './blocos'

/** Data de hoje em Brasília, AAAA-MM-DD. */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

async function ler<T>(consulta: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, nome: string): Promise<T[]> {
  const { data, error } = await consulta
  if (error || !data) throw new Error(`${nome}: ${error?.message ?? 'sem dados'}`)
  return data
}

export async function lerEntradaDosAlertas(admin: SupabaseClient, hoje: string): Promise<EntradaAlertas> {
  const anterior = diaUtilAnterior(hoje)
  const [veiculos, equipes, motoristas, revisoes, documentos, multas, sinistros, km] = await Promise.all([
    ler<EntradaAlertas['veiculos'][number]>(
      admin.from('veiculos').select('id, placa, km_atual, status, equipe_id, previsao_retorno_oficina'),
      'veiculos'
    ),
    ler<EntradaAlertas['equipes'][number]>(admin.from('equipes').select('id, codigo, ativo'), 'equipes'),
    ler<EntradaAlertas['motoristas'][number] & { id: string }>(
      admin.from('motoristas').select('id, nome, cnh_vencimento, equipe_id, ativo'),
      'motoristas'
    ),
    ler<EntradaAlertas['revisoes'][number]>(
      admin.from('revisoes').select('veiculo_id, tipo, proxima_data, proxima_km, created_at'),
      'revisoes'
    ),
    ler<EntradaAlertas['documentos'][number]>(admin.from('documentos_veiculo').select('veiculo_id, tipo, vencimento'), 'documentos_veiculo'),
    ler<{ veiculo_id: string | null; motorista_id: string | null; data: string; valor: number; status: string }>(
      admin.from('multas').select('veiculo_id, motorista_id, data, valor, status').neq('status', 'descontada'),
      'multas'
    ),
    ler<EntradaAlertas['sinistros'][number]>(
      admin.from('sinistros').select('veiculo_id, data, tipo, status').neq('status', 'encerrado'),
      'sinistros'
    ),
    ler<{ equipe_id: string }>(admin.from('km_diario').select('equipe_id').eq('data', anterior), 'km_diario'),
  ])
  const nomeDe = new Map(motoristas.map((m) => [m.id, m.nome]))
  return {
    hoje,
    veiculos,
    equipes,
    motoristas,
    revisoes,
    documentos,
    multas: multas.map((m) => ({
      veiculo_id: m.veiculo_id,
      motorista_nome: m.motorista_id ? (nomeDe.get(m.motorista_id) ?? null) : null,
      data: m.data,
      valor: m.valor,
      status: m.status,
    })),
    sinistros,
    equipesComKmNoDiaUtilAnterior: km.map((k) => k.equipe_id),
  }
}

/** Destinatários: gestores de frotas que ainda têm o slug `sofia` (mesma regra de `sofia_pode_gerir()`). */
export async function lerDestinatarios(admin: SupabaseClient): Promise<string[]> {
  const [gestores, acesso] = await Promise.all([
    ler<{ user_email: string }>(admin.from('sofia_gestores').select('user_email'), 'sofia_gestores'),
    ler<{ user_email: string }>(
      admin.from('hub_system_access').select('user_email').eq('system_slug', 'sofia').eq('has_access', true),
      'hub_system_access'
    ),
  ])
  const comAcesso = new Set(acesso.map((a) => a.user_email.trim().toLowerCase()))
  return [...new Set(gestores.map((g) => g.user_email.trim().toLowerCase()))].filter((e) => e && comAcesso.has(e)).sort()
}
