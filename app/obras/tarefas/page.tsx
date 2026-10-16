/**
 * Tarefas — a falta virando cobrança com dono e prazo.
 *
 * NINGUÉM DIGITA TAREFA AQUI. Toda linha desta tela nasceu no instante em que
 * um analista salvou o diário: ou porque faltou alguma coisa, ou porque a foto
 * do dia não veio. Quem abre está em `app/obras/diario/_actions.ts`.
 *
 * "VENCIDA" NUNCA É GRAVADA (decisão técnica 2 da spec): é `sitTarefa()`,
 * calculada contra hoje. Ela pinta a linha de vermelho e **nada escala** —
 * escalar depende do agendador das 18h/19h, que está fora da v0.
 *
 * Sem filtros e sem seletor de ordenação, como no mockup: agrupado por dono,
 * vencida primeiro, depois quem está há mais tempo com a bola.
 */

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  hojeISO,
  nomeDaEquipe,
  tarefaVisivelNaLista,
  type Etapa,
  type ObraRow,
  type TarefaRow,
} from '../_lib/tipos'
import { lerTodasAsLinhas } from '../_lib/ler-paginas'
import { ETAPAS_FILA_DIARIO } from '../_lib/agendamento'
import { resolverChave } from '../diario/_pessoa'
import Lista, { type ObraDaTarefa, type PessoaDaTarefa } from './_lista'
import Agendadas, { type ObraAgendada } from './_agendadas'

type TarefaComObra = TarefaRow & {
  obras_obra: Pick<ObraRow, 'id' | 'os' | 'loja' | 'equipe' | 'pcm' | 'etapa'> | null
}

export const dynamic = 'force-dynamic'

export default async function TarefasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  if (!email) return <Erro />

  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return <Erro />

  const hoje = hojeISO()

  // Todas as tarefas, em páginas. Antes era `limit(500)` por `aberta desc`: a
  // tarefa aberta há mais tempo — justamente a mais vencida — era a primeira a
  // cair fora do corte, sem aviso. A obra de cada tarefa vem embutida (FK
  // `obra_id`), em vez de um `.in('id', [centenas de UUIDs])` na URL.
  // `obras_pessoa` não depende das tarefas: vai junto.
  const [{ data: linhas, error }, { data: linhasPessoa }, agendadasLidas, minhaChave] = await Promise.all([
    lerTodasAsLinhas<TarefaComObra>((de, ate, estavel) => {
      const q = supabase
        .from('obras_tarefa')
        .select('*, obras_obra(id, os, loja, equipe, pcm, etapa)')
        .order('aberta', { ascending: false })
      return (estavel ? q.order('id', { ascending: true }) : q).range(de, ate)
    }),
    supabase.from('obras_pessoa').select('chave, nome, area, email'),
    // Obras agendadas para fora do diário (spec 16/10/2026 §7): poucas linhas.
    supabase
      .from('obras_obra')
      .select('id, os, loja, pcm, etapa, diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por')
      .not('diario_agendado_ate', 'is', null)
      .in('etapa', ETAPAS_FILA_DIARIO),
    admin ? Promise.resolve('') : resolverChave(supabase, email),
  ])
  if (error || agendadasLidas.error) return <Erro />

  // Admin vê todas; os demais, só as obras em que são PCM (chave vazia nunca casa).
  const agendadas = ((agendadasLidas.data ?? []) as ObraAgendada[]).filter(
    (o) => admin || (!!minhaChave && o.pcm === minhaChave)
  )
  const pessoasPorEmail = ((linhasPessoa ?? []) as { nome: string; email?: string | null }[])
    .filter((p): p is { nome: string; email: string } => !!p.email)
    .map((p) => ({ email: p.email, nome: p.nome }))

  const tarefas: TarefaRow[] = []
  const obras: Record<string, ObraDaTarefa> = {}
  const etapaDaObra: Record<string, Etapa> = {}
  for (const { obras_obra: o, ...tarefa } of linhas ?? []) {
    tarefas.push(tarefa)
    if (!o) continue
    etapaDaObra[o.id] = o.etapa
    obras[o.id] = {
      id: o.id,
      os: o.os,
      loja: o.loja,
      equipe: nomeDaEquipe(o),
    }
  }

  const pessoas: Record<string, PessoaDaTarefa> = Object.fromEntries(
    ((linhasPessoa ?? []) as { chave: string; nome: string; area: string | null }[]).map((p) => [
      p.chave,
      { nome: p.nome, area: p.area },
    ])
  )

  // Cancelamento de obra (spec-cancelamento §8): a tarefa ABERTA de obra
  // cancelada sai da lista; volta sozinha se o cancelamento for desfeito.
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        <Agendadas obras={agendadas} pessoasPorEmail={pessoasPorEmail} hoje={hoje} />
      </div>
      <Lista
        tarefas={tarefas.filter((t) => tarefaVisivelNaLista(t, etapaDaObra[t.obra_id]))}
        obras={obras}
        pessoas={pessoas}
        hoje={hoje}
      />
    </>
  )
}

function Erro() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-[#ff4d6d] bg-[#0d2050] px-4 py-5">
        <h1 className="text-base font-semibold text-[#e8eef7]">Não deu para carregar as tarefas</h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          A lista não chegou. <b className="text-[#e8eef7]">Nada do que já foi respondido foi perdido</b> — o que
          estava salvo continua salvo.
        </p>
        <a
          href="/obras/tarefas"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-[#f05a28] px-3 py-2 text-sm font-medium text-white hover:bg-[#d94d20]"
        >
          Tentar de novo
        </a>
      </div>
    </div>
  )
}
