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

import { br, moeda, nomeEtapa, type Etapa } from './tipos'

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
