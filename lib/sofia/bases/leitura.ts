/**
 * Leituras das bases — SEMPRE com o cliente Supabase do usuário (RLS), nunca service role.
 * O PostgREST corta em 1000 linhas por consulta: `buscarTudo` pagina para que o
 * "Exportar" leve tudo o que está filtrado e a tela não esconda registros antigos.
 */
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '../permissoes'
import type { CorrecaoAudit } from '../correcoes'
import {
  montarAbastecimentos, montarKm, montarMotoristas, montarVeiculos,
  type AbastBruto, type EntradaMontagem, type EquipeBruta, type KmBruto, type MotoristaBruto, type VeiculoBruto,
} from './montar'
import type { TrechoBruto } from './responsabilidade'
import type { BaseId, Linha } from './tipos'

const LOTE = 1000

/** Chama `pagina(de, ate)` até vir um lote incompleto. Erro vira exceção (nunca lista vazia silenciosa). */
export async function buscarTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await pagina(de, de + LOTE - 1)
    if (error) {
      console.error('[sofia/bases] leitura falhou:', error)
      throw new Error('Erro ao carregar dados do sistema. Recarregue a página; se persistir, avise o suporte.')
    }
    const lote = data ?? []
    out.push(...lote)
    if (lote.length < LOTE) return out
  }
}

export function hojeSP(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

export interface BaseCarregada {
  linhas: Linha[]
  hoje: string
  podeGerir: boolean
  /** opções dos filtros */
  equipes: string[]
  placas: string[]
  motoristas: string[]
}

const need = {
  abast: ['equipes', 'motoristas', 'veiculos', 'responsabilidade', 'abastecimentos', 'corrigidosAbast'],
  km: ['equipes', 'motoristas', 'veiculos', 'km', 'correcoesKm'],
  mot: ['equipes', 'motoristas'],
  veic: ['equipes', 'motoristas', 'veiculos', 'responsabilidade', 'abastecimentos', 'km'],
} as const

export async function carregarBase(base: BaseId): Promise<BaseCarregada> {
  const supabase = await createClient()
  const hoje = hojeSP()
  const podeGerir = await podeGerirFrotas(supabase)
  const quer = new Set<string>(need[base])
  const vazio = <T,>(): Promise<T[]> => Promise.resolve([])

  const [equipes, motoristas, veiculos, responsabilidade, abastecimentos, km, auditAbast, auditKm] = await Promise.all([
    buscarTudo<EquipeBruta>((a, b) => supabase.from('equipes').select('id, codigo').order('codigo').range(a, b)),
    buscarTudo<MotoristaBruto>((a, b) => supabase.from('motoristas').select('*').order('nome').range(a, b)),
    quer.has('veiculos') ? buscarTudo<VeiculoBruto>((a, b) => supabase.from('veiculos').select('*').order('placa').range(a, b)) : vazio<VeiculoBruto>(),
    quer.has('responsabilidade')
      ? buscarTudo<TrechoBruto>((a, b) => supabase.from('veiculo_responsabilidade_historico').select('veiculo_id, equipe_id, motorista_id, inicio, fim, created_at').order('id').range(a, b))
      : vazio<TrechoBruto>(),
    quer.has('abastecimentos')
      ? buscarTudo<AbastBruto>((a, b) => supabase.from('abastecimentos').select('id, veiculo_id, data, litros, valor, km, posto, created_at').order('id').range(a, b))
      : vazio<AbastBruto>(),
    quer.has('km')
      ? buscarTudo<KmBruto>((a, b) => supabase.from('km_diario').select('id, veiculo_id, equipe_id, motorista_id, data, km_atual, observacoes, created_at').order('id').range(a, b))
      : vazio<KmBruto>(),
    quer.has('corrigidosAbast')
      ? buscarTudo<CorrecaoAudit>((a, b) => supabase.from('audit_log').select('registro_id, created_at, dados').eq('operacao', 'corrigiu').eq('tabela', 'abastecimentos').order('id').range(a, b))
      : vazio<CorrecaoAudit>(),
    quer.has('correcoesKm')
      ? buscarTudo<CorrecaoAudit>((a, b) => supabase.from('audit_log').select('registro_id, created_at, dados').eq('operacao', 'corrigiu').eq('tabela', 'km_diario').order('id').range(a, b))
      : vazio<CorrecaoAudit>(),
  ])

  const entrada: EntradaMontagem = {
    hoje, equipes, motoristas, veiculos, responsabilidade, abastecimentos, km,
    corrigidosAbast: new Set(auditAbast.map((c) => c.registro_id).filter((x): x is string => !!x)),
    correcoesKm: auditKm,
    comContexto: podeGerir,
  }
  const linhas: Linha[] =
    base === 'abast' ? montarAbastecimentos(entrada)
    : base === 'km' ? montarKm(entrada)
    : base === 'mot' ? montarMotoristas(entrada)
    : montarVeiculos(entrada)

  return {
    linhas,
    hoje,
    podeGerir,
    equipes: equipes.map((e) => e.codigo),
    placas: veiculos.map((v) => v.placa),
    motoristas: motoristas.map((m) => m.nome),
  }
}
