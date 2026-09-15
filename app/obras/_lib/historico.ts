/**
 * Histórico de alterações da obra — J4, seção D do mockup (aprovada).
 * Ver docs/cliente/2026-08-31-sistema-controle-de-obras/spec-historico-alteracoes-2026-09-15.md
 *
 * Convenção deste arquivo: `campo` grava uma CHAVE ESTÁVEL (nunca o texto de
 * tela) — o rótulo se traduz na leitura, via ROTULO_CAMPO, do mesmo jeito que
 * `nomeEtapa()` traduz `etapa` em tipos.ts. Se o rótulo mudar (ex.: a decisão
 * 8 ainda pendente do cliente sobre o nome de marco_liberou_fat), as linhas
 * já gravadas continuam corretas sem backfill.
 */

import { br, moeda, nomeEtapa, type Etapa, type ObraRow } from './tipos'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BlocoHistorico =
  | 'Triagem'
  | 'Autorização'
  | 'Identificação'
  | 'Cronograma'
  | 'Esteira'

export type CampoHistorico =
  | 'pcm'
  | 'equipe'
  | 'prioridade'
  | 'inicio_plan'
  | 'duracao'
  | 'liberado_por'
  | 'liberado_em'
  | 'os_aprovada_em'
  | 'tipo'
  | 'valor'
  | 'origem'
  | 'analista_cliente'
  | 'mau_uso'
  | 'etapa'
  | 'marco_exec_fim'
  | 'marco_relatorio'
  | 'marco_fechou_os'
  | 'marco_liberou_fat'
  | 'marco_faturou'

/** Rótulo de tela para cada campo rastreado. Ver spec §7. */
export const ROTULO_CAMPO: Record<CampoHistorico, string> = {
  pcm: 'Responsável da obra',
  equipe: 'Equipe / prestador',
  prioridade: 'Prioridade',
  inicio_plan: 'Início planejado',
  duracao: 'Duração em dias',
  liberado_por: 'Liberado por',
  liberado_em: 'Data da liberação',
  os_aprovada_em: 'OS aprovada em',
  tipo: 'Tipo',
  valor: 'Valor',
  origem: 'Origem',
  analista_cliente: 'Analista do cliente',
  mau_uso: 'Classificação',
  etapa: 'Etapa',
  marco_exec_fim: 'Data de fim da execução em campo',
  marco_relatorio: 'Data do relatório de entrega',
  marco_fechou_os: 'Data de fechamento da OS',
  marco_liberou_fat: 'Data do faturamento liberado',
  marco_faturou: 'Data de faturamento',
}

/** Uma linha ainda não gravada — o formato que a RPC espera em `p_linhas`. */
export type LinhaHistoricoNova = {
  bloco: BlocoHistorico
  campo: CampoHistorico
  de: string | null
  para: string | null
  motivo?: string | null
}

/** Uma linha já gravada, lida de volta do banco. */
export type LinhaHistorico = LinhaHistoricoNova & {
  id: string
  obra_id: string
  quem: string
  created_at: string
}

const CAMPOS_DATA: ReadonlySet<CampoHistorico> = new Set([
  'inicio_plan', 'liberado_em', 'os_aprovada_em',
  'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
  'marco_liberou_fat', 'marco_faturou',
])

function formatarValor(campo: CampoHistorico, v: string | number | boolean | null): string | null {
  if (v === null || v === undefined || v === '') return null
  if (campo === 'valor') return moeda(Number(v))
  if (campo === 'duracao') return `${v} dias`
  if (campo === 'mau_uso') return v ? 'Mau uso' : 'normal'
  if (campo === 'etapa') return nomeEtapa(v as Etapa)
  if (CAMPOS_DATA.has(campo)) return br(String(v))
  return String(v)
}

/** Compara valor "cru" (não formatado) para decidir se algo realmente mudou. */
function iguais(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined): boolean {
  const na = a === undefined || a === '' ? null : a
  const nb = b === undefined || b === '' ? null : b
  if (na === null && nb === null) return true
  if (na === null || nb === null) return false
  // números: comparação numérica, evita ruído de string "100" vs 100 ou "100.0" vs "100"
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb)
  return String(na) === String(nb)
}

export function linhasDeAlteracao(
  antes: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  depois: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  bloco: BlocoHistorico,
  opts?: { motivoRemarcacao?: string | null; exigirMotivoRemarcacao?: boolean }
): LinhaHistoricoNova[] {
  const linhas: LinhaHistoricoNova[] = []

  for (const campo of Object.keys(depois) as CampoHistorico[]) {
    const antigo = antes[campo] ?? null
    const novo = depois[campo] ?? null
    if (iguais(antigo, novo)) continue

    if (campo === 'inicio_plan' && opts?.exigirMotivoRemarcacao) {
      const motivo = (opts.motivoRemarcacao ?? '').trim()
      if (!motivo) {
        throw new Error(
          'linhasDeAlteracao: início mudou com exigirMotivoRemarcacao=true e sem motivoRemarcacao — quem chamou esqueceu de validar antes.'
        )
      }
    }

    linhas.push({
      bloco,
      campo,
      de: formatarValor(campo, antigo),
      para: formatarValor(campo, novo),
      motivo: campo === 'inicio_plan' ? (opts?.motivoRemarcacao ?? null) : null,
    })
  }

  return linhas
}

export async function gravarComHistorico(
  supabase: SupabaseClient,
  params: { obraId: string; campos: Record<string, unknown>; linhas: LinhaHistoricoNova[] }
): Promise<{ data?: ObraRow; error?: string }> {
  const { data, error } = await supabase.rpc('obras_aplicar_alteracao', {
    p_obra_id: params.obraId,
    p_campos: params.campos,
    p_linhas: params.linhas,
  })

  if (error) return { error: 'Erro ao salvar a alteração da obra' }
  return { data: data as ObraRow }
}
