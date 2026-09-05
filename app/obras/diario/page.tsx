/**
 * Diário do dia — a tela que sustenta o sistema inteiro.
 *
 * FORMA CARTÕES, uma obra por vez (decisão B, forma 1). A forma "lista única"
 * do mockup NÃO entra na v0 — está cortada na spec §1.
 *
 * DE QUEM É A FILA (decisão técnica 7 da spec): das obras em campo onde o
 * USUÁRIO LOGADO é o `pcm`. O mockup demonstra só o diário do Yuri, com a
 * `FILA` fixa em `pcm === "YURI"` — aquilo é simplificação de demo, e está
 * listado como tal em modelo-mockup.md §6. Terça treina a equipe inteira, então
 * cada um vê o seu. Administrador vê todas, com seletor de responsável.
 *
 * "EM CAMPO" aqui é o mesmo recorte do mockup: `!posCampo(o)` — levantamento,
 * em andamento e paralisado. Obra em `definir` fica de fora de propósito: sem
 * responsável, sem equipe e sem cronograma ela não tem o que responder, e o
 * próprio mockup diz que "nenhuma delas entra no diário enquanto ficar assim".
 *
 * Server Component: busca e deriva. Quem responde é `_cartoes.tsx`, client.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { derivar, hojeISO, type Etapa, type ObraRow, type Obra } from '../_lib/tipos'
import { chaveDoUsuario } from './_pessoa'
import Cartoes, { type RespostaDeHoje, type TarefaDeHoje } from './_cartoes'
import type { Pessoa } from './_cartao'

/** As três etapas em que faz sentido perguntar "andou hoje?". */
const ETAPAS_FILA: Etapa[] = ['levantamento', 'andamento', 'paralisado']

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ analista?: string }> }

export default async function DiarioPage({ searchParams }: Props) {
  const { analista } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  if (!email) return <SemPermissao />

  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return <SemPermissao />

  const hoje = hojeISO()
  const minhaChave = chaveDoUsuario(email)
  // Administrador enxerga todo mundo e escolhe de quem é a fila; analista vê a
  // sua e só a sua. O filtro do não-admin vai no banco, não na memória.
  const filtroPcm = admin ? (analista || '') : minhaChave

  let consulta = supabase.from('obras_obra').select('*').in('etapa', ETAPAS_FILA)
  if (filtroPcm) consulta = consulta.eq('pcm', filtroPcm)
  const { data: linhas, error } = await consulta

  if (error) return <Erro />

  const obras: Obra[] = ((linhas ?? []) as ObraRow[]).map((o) => derivar(o, hoje))
  const ids = obras.map((o) => o.id)

  // Analista que não é `pcm` de obra nenhuma não tem diário — e é isso que o
  // mockup diz, com estas palavras. Administrador não cai aqui: ele vê todas.
  if (!admin && ids.length === 0) return <SemPermissao />

  // `obras_pessoa` é a tabela de quem pode ser dono de tarefa. É pequena (4
  // linhas semeadas + as equipes da importação) e o cartão precisa dela para
  // dizer PARA QUEM a tarefa vai antes de ela ir.
  const { data: linhasPessoa } = await supabase.from('obras_pessoa').select('chave, nome, area')
  const nomes = new Map<string, Pessoa>(
    ((linhasPessoa ?? []) as { chave: string; nome: string; area: string | null }[]).map((p) => [
      p.chave,
      { nome: p.nome, area: p.area },
    ])
  )
  const pessoas: Record<string, Pessoa> = Object.fromEntries(nomes)

  // Quem já respondeu hoje, e as tarefas que essas respostas abriram.
  let respostas: Record<string, RespostaDeHoje> = {}
  const tarefas: Record<string, TarefaDeHoje[]> = {}
  if (ids.length) {
    const [diario, tarefasHoje] = await Promise.all([
      supabase
        .from('obras_diario')
        .select('obra_id, andou, motivo, item, obs, foto_path')
        .eq('data', hoje)
        .in('obra_id', ids),
      supabase
        .from('obras_tarefa')
        .select('id, obra_id, item, dono, prazo')
        .eq('aberta', hoje)
        .in('obra_id', ids),
    ])

    if (diario.error) return <Erro />

    respostas = Object.fromEntries(
      (diario.data ?? []).map((d) => [d.obra_id as string, d as unknown as RespostaDeHoje])
    )

    for (const t of tarefasHoje.data ?? []) {
      const obraId = t.obra_id as string
      const chave = (t.dono as string | null) ?? ''
      const pessoa = nomes.get(chave)
      const lista = tarefas[obraId] ?? (tarefas[obraId] = [])
      lista.push({
        id: t.id as string,
        item: t.item as string,
        prazo: (t.prazo as string | null) ?? null,
        // Equipe de campo não está semeada em obras_pessoa — ela nasce da
        // própria obra (`chaveDaEquipe`). Sem nome cadastrado, o rótulo é o
        // papel, que é o que a pessoa que lê precisa saber.
        dono: pessoa ? pessoa.nome.split(' ')[0] : chave.startsWith('EQ_') ? 'a equipe da obra' : chave,
        area: pessoa?.area ?? (chave.startsWith('EQ_') ? 'Equipe em campo' : null),
      })
    }
  }

  // O seletor do administrador só oferece quem tem obra em campo — lista de
  // gente sem obra é lista que ninguém escolhe.
  let responsaveis: string[] = []
  if (admin) {
    const { data: todos } = await supabase.from('obras_obra').select('pcm').in('etapa', ETAPAS_FILA)
    responsaveis = Array.from(
      new Set(((todos ?? []) as { pcm: string | null }[]).map((o) => o.pcm).filter((p): p is string => !!p))
    ).sort()
  }

  return (
    <Cartoes
      obras={obras}
      respostas={respostas}
      tarefas={tarefas}
      pessoas={pessoas}
      hoje={hoje}
      admin={admin}
      responsaveis={responsaveis}
      analistaSelecionado={filtroPcm}
    />
  )
}

/**
 * Estado de erro. O texto é o do mockup (`:2916`) e a promessa dele é
 * verdadeira: o que já foi salvo está no banco, não nesta tela.
 * O "Tentar de novo" é um `<a>` e não um `<Link>` de propósito — recarregar a
 * rota inteira é exatamente o que se quer aqui.
 */
function Erro() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-[#ff4d6d] bg-[#0d2050] px-4 py-5">
        <h1 className="text-base font-semibold text-[#e8eef7]">
          Não deu para carregar o diário de hoje
        </h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          A lista de obras não chegou. <b className="text-[#e8eef7]">Nada do que você já respondeu foi perdido</b> — o
          que estava salvo continua salvo.
        </p>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Tente de novo. Se continuar assim por mais de alguns minutos, avise o suporte da Manfac e responda hoje pelo
          WhatsApp.
        </p>
        <a
          href="/obras/diario"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-[#f05a28] px-3 py-2 text-sm font-medium text-white hover:bg-[#d94d20]"
        >
          Tentar de novo
        </a>
      </div>
    </div>
  )
}

/** Texto do mockup (`:2932`). O middleware já barra quem não tem acesso — esta
 *  tela é para quem tem acesso ao módulo mas não é responsável por obra nenhuma. */
function SemPermissao() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-5">
        <h1 className="text-base font-semibold text-[#e8eef7]">
          Esta tela é de quem é responsável pelas obras
        </h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Seu acesso não inclui o diário destas obras. Quem responde é o analista responsável por elas.
        </p>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Se você precisa responder no lugar dele, peça ao administrador para incluir seu acesso. A base de obras
          continua aberta para consulta.
        </p>
        <Link
          href="/obras/base"
          className="mt-4 inline-flex items-center justify-center rounded-md border border-[#1e3a5f] px-3 py-2 text-sm font-medium text-[#e8eef7] hover:bg-[#132a52]"
        >
          Ver a base de obras
        </Link>
      </div>
    </div>
  )
}
