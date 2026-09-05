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
  type ObraRow,
  type TarefaRow,
} from '../_lib/tipos'
import Lista, { type ObraDaTarefa, type PessoaDaTarefa } from './_lista'

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

  const { data: linhas, error } = await supabase
    .from('obras_tarefa')
    .select('*')
    .order('aberta', { ascending: false })
    .limit(500)
  if (error) return <Erro />

  const tarefas = (linhas ?? []) as TarefaRow[]
  const idsObra = Array.from(new Set(tarefas.map((t) => t.obra_id)))

  const obras: Record<string, ObraDaTarefa> = {}
  if (idsObra.length) {
    const { data: linhasObra } = await supabase
      .from('obras_obra')
      .select('id, os, loja, equipe, pcm')
      .in('id', idsObra)
    for (const o of (linhasObra ?? []) as Pick<ObraRow, 'id' | 'os' | 'loja' | 'equipe' | 'pcm'>[]) {
      obras[o.id] = {
        id: o.id,
        os: o.os,
        loja: o.loja,
        equipe: nomeDaEquipe(o),
      }
    }
  }

  const { data: linhasPessoa } = await supabase.from('obras_pessoa').select('chave, nome, area')
  const pessoas: Record<string, PessoaDaTarefa> = Object.fromEntries(
    ((linhasPessoa ?? []) as { chave: string; nome: string; area: string | null }[]).map((p) => [
      p.chave,
      { nome: p.nome, area: p.area },
    ])
  )

  return <Lista tarefas={tarefas} obras={obras} pessoas={pessoas} hoje={hoje} />
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
