/**
 * Leitura do painel "Revisão a cada 10 mil km" (/sofia/revisoes) — cliente do usuário (RLS).
 */
import { createClient } from '@/lib/supabase/server'
import { buscarTudo, hojeSP } from './bases/leitura'
import { podeGerirFrotas } from './permissoes'
import {
  classificarFrota, contarCartoes, mediaKmDia, somarDias,
  type ItemFrota, type RevisaoPrev, type VeiculoPrev,
} from './revisaoPrevisao'
import type { ContextoImportacao } from './revisaoImportacao'

export type VeiculoPainel = VeiculoPrev & { equipe: string | null }
export type ItemPainel = ItemFrota<VeiculoPainel>

interface VeiculoLido extends VeiculoPrev { equipe_id: string | null }
interface KmLido { veiculo_id: string; data: string; km_atual: number }

export interface PainelRevisoes {
  hoje: string
  podeGerir: boolean
  lista: ItemPainel[]
  cartoes: ReturnType<typeof contarCartoes>
  comIntervaloProprio: number
  totalRevisoes: number
  /** só para gestor: o que a prévia da importação precisa conferir */
  contextoImportacao: Omit<ContextoImportacao, 'hoje'> | null
}

const SEL_REV = 'id, veiculo_id, tipo, km_realizada, data_realizada, created_at, proxima_km, proxima_data, prever_proxima'

export async function carregarPainelRevisoes(): Promise<PainelRevisoes> {
  const supabase = await createClient()
  const hoje = hojeSP()
  const [podeGerir, veiculos, revisoes, km, equipes] = await Promise.all([
    podeGerirFrotas(supabase),
    buscarTudo<VeiculoLido>((a, b) =>
      supabase.from('veiculos').select('id, placa, modelo, km_atual, status, intervalo_revisao_km, equipe_id').order('placa').range(a, b)),
    buscarTudo<RevisaoPrev>((a, b) => supabase.from('revisoes').select(SEL_REV).order('id').range(a, b)),
    buscarTudo<KmLido>((a, b) =>
      supabase.from('km_diario').select('veiculo_id, data, km_atual').gte('data', somarDias(hoje, -30)).order('id').range(a, b)),
    buscarTudo<{ id: string; codigo: string }>((a, b) => supabase.from('equipes').select('id, codigo').order('codigo').range(a, b)),
  ])
  const cod = new Map(equipes.map((e) => [e.id, e.codigo]))
  const comEquipe: VeiculoPainel[] = veiculos.map((v) => ({
    id: v.id, placa: v.placa, modelo: v.modelo, km_atual: Number(v.km_atual), status: v.status,
    intervalo_revisao_km: v.intervalo_revisao_km ?? null, equipe: v.equipe_id ? cod.get(v.equipe_id) ?? null : null,
  }))
  const lista = classificarFrota(comEquipe, revisoes, km, hoje)
  return {
    hoje,
    podeGerir,
    lista,
    cartoes: contarCartoes(lista),
    comIntervaloProprio: comEquipe.filter((v) => v.status !== 'inativo' && v.intervalo_revisao_km != null).length,
    totalRevisoes: revisoes.length,
    contextoImportacao: podeGerir
      ? {
          veiculos: comEquipe.map((v) => ({ id: v.id, placa: v.placa, km_atual: v.km_atual, intervalo_revisao_km: v.intervalo_revisao_km })),
          existentes: revisoes.map((r) => ({ veiculo_id: r.veiculo_id, km_realizada: r.km_realizada })),
        }
      : null,
  }
}

/** Formulário de revisão: média km/dia (últimos 30 dias) por veículo. */
export async function mediasKmDia(): Promise<Record<string, number | null>> {
  const supabase = await createClient()
  const hoje = hojeSP()
  const km = await buscarTudo<KmLido>((a, b) =>
    supabase.from('km_diario').select('veiculo_id, data, km_atual').gte('data', somarDias(hoje, -30)).order('id').range(a, b))
  const por = new Map<string, KmLido[]>()
  for (const k of km) por.set(k.veiculo_id, [...(por.get(k.veiculo_id) ?? []), k])
  return Object.fromEntries([...por.entries()].map(([id, l]) => [id, mediaKmDia(l, hoje)]))
}
