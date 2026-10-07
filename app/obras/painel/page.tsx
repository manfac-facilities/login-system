/**
 * Painel gerencial — `/obras/painel`.
 *
 * Spec: docs/cliente/2026-08-31-sistema-controle-de-obras/spec-painel-gerencial-2026-09-29.md
 *
 * Server Component: lê o banco com o cliente Supabase do usuário (RLS dele),
 * monta o painel inteiro em `montarPainel` (função pura, testada) e entrega o
 * resultado pronto à tela. Cliente, mês e comparação chegam pela URL.
 *
 * Leituras (sem N+1): obras, diário, tarefas e remarcações — cada uma inteira,
 * em páginas, porque o PostgREST corta a resposta em 1.000 linhas e o diário
 * passa disso em poucas semanas.
 *
 * `select('*')` nas obras DE PROPÓSITO: a coluna `cliente` vem de outra frente
 * e pode ainda não existir no banco. Pedir a coluna pelo nome derrubaria a tela.
 */

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../_lib/tipos'
import { EstadoVazio } from '../_ui/primitivos'
import { lerTodasAsLinhas } from '../_lib/ler-paginas'
import {
  MESES_LONGOS,
  montarPainel,
  somaMeses,
  type Comparacao,
  type LinhaDiario,
  type LinhaRemarcacao,
  type LinhaTarefa,
  type ObraPainel,
} from './_calculos'
import PainelGerencial from './_painel'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ cliente?: string; mes?: string; cmp?: string }> }

export default async function PainelPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  const permitido =
    !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  /** Lê a tabela inteira em páginas estáveis (ordenadas por id). */
  async function lerTudo<T>(tabela: string, colunas: string): Promise<T[] | null> {
    const { data, error } = await lerTodasAsLinhas<T>(async (de, ate) => {
      const r = await supabase
        .from(tabela)
        .select(colunas)
        .order('id', { ascending: true })
        .range(de, ate)
      return { data: r.data as T[] | null, error: r.error }
    })
    return error ? null : data
  }

  const [obras, diario, tarefas, remarcacoes] = await Promise.all([
    lerTudo<ObraPainel>('obras_obra', '*'),
    lerTudo<LinhaDiario>('obras_diario', 'obra_id, data, andou, motivo, foto_path'),
    lerTudo<LinhaTarefa>('obras_tarefa', 'obra_id, situacao, prazo, resposta_em'),
    lerTudo<LinhaRemarcacao>('obras_remarcacao', 'obra_id, data, de, para, created_at'),
  ])

  // Um número zerado por falha de leitura é pior que número nenhum: passaria
  // por "não faturamos nada". Qualquer leitura que falhe derruba o painel todo.
  if (!obras || !diario || !tarefas || !remarcacoes) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>
          Não deu para carregar o painel gerencial. Recarregue a página em alguns instantes.
        </EstadoVazio>
      </div>
    )
  }

  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  // O seletor oferece os 12 meses até o atual — os mesmos do histórico.
  const meses = Array.from({ length: 12 }, (_, i) => {
    const v = somaMeses(mesAtual, -i)
    const nome = `${MESES_LONGOS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}${i === 0 ? ' (atual)' : ''}`
    return { v, nome }
  })
  const mes = meses.some((m) => m.v === params.mes) ? params.mes! : mesAtual
  const cmp: Comparacao = params.cmp === 'yoy' ? 'yoy' : 'prev'

  const painel = montarPainel(
    { obras, diario, tarefas, remarcacoes, hoje },
    { cliente: params.cliente || null, mes, cmp }
  )

  return <PainelGerencial painel={painel} meses={meses} />
}
