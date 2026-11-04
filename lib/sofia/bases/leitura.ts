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
import {
  montarCorretivas, montarDocumentos, montarMultas, montarRevisoes, montarSinistros,
  type CorrBruta, type DocBruto, type KmRecente, type MultaBruta, type RevBruta, type SinBruto,
} from './montar-novas'
import { somarDias } from '../revisaoPrevisao'
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
  veiculos: VeiculoBruto[]
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
  rev: ['veiculos', 'revisoes', 'kmRecentes'],
  corr: ['veiculos', 'responsabilidade', 'manutencoes'],
  multa: ['veiculos', 'multas'],
  sin: ['veiculos', 'sinistros'],
  doc: ['veiculos', 'documentos'],
} as const

// Colunas explícitas; storage_path/anexo só para calcular "temArquivo" (nunca chegam à linha).
const SEL_REV =
  'id, veiculo_id, motorista_id, tipo, fornecedor, valor, data_realizada, km_realizada, proxima_km, proxima_data, prever_proxima, origem, observacoes, pecas_trocadas, created_at'
const SEL_CORR =
  'id, veiculo_id, defeito, oficina, data_entrada, saida_prevista, data_saida, custo, quem_arca, status, tirou_da_equipe, anexo_storage_path, observacoes, created_at'
const SEL_MULTA =
  'id, veiculo_id, motorista_id, data, tipo_infracao, descricao, valor, valor_descontado, status, autorizacao_status, autorizacao_solicitado_em, created_at'
const SEL_SIN =
  'id, veiculo_id, motorista_id, data, tipo, descricao, valor_dano, valor_descontado, tipo_desconto, status, autorizacao_status, autorizacao_solicitado_em, created_at'
const SEL_DOC = 'id, veiculo_id, tipo, numero, vencimento, storage_path'

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
  const [revisoes, kmRecentes, manutencoes, multas, sinistros, documentos] = await Promise.all([
    quer.has('revisoes') ? buscarTudo<RevBruta>((a, b) => supabase.from('revisoes').select(SEL_REV).order('id').range(a, b)) : vazio<RevBruta>(),
    quer.has('kmRecentes')
      ? buscarTudo<KmRecente>((a, b) => supabase.from('km_diario').select('veiculo_id, data, km_atual').gte('data', somarDias(hoje, -30)).order('id').range(a, b))
      : vazio<KmRecente>(),
    quer.has('manutencoes') ? buscarTudo<CorrBruta>((a, b) => supabase.from('manutencoes').select(SEL_CORR).order('id').range(a, b)) : vazio<CorrBruta>(),
    quer.has('multas') ? buscarTudo<MultaBruta>((a, b) => supabase.from('multas').select(SEL_MULTA).order('id').range(a, b)) : vazio<MultaBruta>(),
    quer.has('sinistros') ? buscarTudo<SinBruto>((a, b) => supabase.from('sinistros').select(SEL_SIN).order('id').range(a, b)) : vazio<SinBruto>(),
    quer.has('documentos') ? buscarTudo<DocBruto>((a, b) => supabase.from('documentos_veiculo').select(SEL_DOC).order('id').range(a, b)) : vazio<DocBruto>(),
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
    : base === 'veic' ? montarVeiculos(entrada)
    : base === 'rev' ? montarRevisoes({ hoje, veiculos, motoristas, revisoes, kmRecentes })
    : base === 'corr' ? montarCorretivas({ hoje, veiculos, motoristas, responsabilidade, manutencoes })
    : base === 'multa' ? montarMultas({ veiculos, motoristas, multas })
    : base === 'sin' ? montarSinistros({ veiculos, motoristas, sinistros })
    : montarDocumentos({ hoje, veiculos, documentos })

  return {
    linhas,
    hoje,
    podeGerir,
    veiculos,
    equipes: equipes.map((e) => e.codigo),
    placas: veiculos.map((v) => v.placa),
    motoristas: motoristas.map((m) => m.nome),
  }
}
