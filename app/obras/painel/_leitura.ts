/**
 * Leitura dos dados do painel gerencial — compartilhada pela tela e pela rota
 * do relatório por e-mail, para os dois mostrarem os mesmos números.
 *
 * Leituras (sem N+1): obras, diário, tarefas e remarcações — cada uma inteira,
 * em páginas, porque o PostgREST corta a resposta em 1.000 linhas e o diário
 * passa disso em poucas semanas.
 *
 * `select('*')` nas obras DE PROPÓSITO: a coluna `cliente` vem de outra frente
 * e pode ainda não existir no banco. Pedir a coluna pelo nome derrubaria a tela.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { lerTodasAsLinhas } from '../_lib/ler-paginas'
import type { LinhaDiario, LinhaRemarcacao, LinhaTarefa, ObraPainel } from './_calculos'

export type EntradaDoPainel =
  | {
      ok: true
      obras: ObraPainel[]
      diario: LinhaDiario[]
      tarefas: LinhaTarefa[]
      remarcacoes: LinhaRemarcacao[]
    }
  | { ok: false; erro: string }

export async function lerEntradaDoPainel(supabase: SupabaseClient): Promise<EntradaDoPainel> {
  /** Lê a tabela inteira em páginas estáveis (ordenadas por id). */
  async function lerTudo<T>(tabela: string, colunas: string) {
    const { data, error } = await lerTodasAsLinhas<T>(async (de, ate) => {
      const r = await supabase
        .from(tabela)
        .select(colunas)
        .order('id', { ascending: true })
        .range(de, ate)
      return { data: r.data as T[] | null, error: r.error }
    })
    return { tabela, data, error }
  }

  const leituras = await Promise.all([
    lerTudo<ObraPainel>('obras_obra', '*'),
    lerTudo<LinhaDiario>('obras_diario', 'obra_id, data, andou, motivo, foto_path'),
    lerTudo<LinhaTarefa>('obras_tarefa', 'obra_id, situacao, prazo, resposta_em'),
    lerTudo<LinhaRemarcacao>('obras_remarcacao', 'obra_id, data, de, para, created_at'),
  ])
  const [obras, diario, tarefas, remarcacoes] = leituras

  // Um número zerado por falha de leitura é pior que número nenhum: passaria
  // por "não faturamos nada". Qualquer leitura que falhe derruba o painel todo.
  const falha = leituras.find((l) => l.error || !l.data)
  if (falha) return { ok: false, erro: `${falha.tabela}: ${falha.error?.message ?? 'sem dados'}` }

  return {
    ok: true,
    obras: obras.data as ObraPainel[],
    diario: diario.data as LinhaDiario[],
    tarefas: tarefas.data as LinhaTarefa[],
    remarcacoes: remarcacoes.data as LinhaRemarcacao[],
  }
}
