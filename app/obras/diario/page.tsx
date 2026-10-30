/**
 * Diário do dia — a tela que sustenta o sistema inteiro.
 *
 * FORMA CARTÕES, uma obra por vez (decisão B, forma 1). A forma "lista única"
 * do mockup NÃO entra na v0 — está cortada na spec §1.
 *
 * DE QUEM É A FILA (spec 27/10/2026, "diário para todos"): qualquer pessoa com
 * acesso a Gestão de Obras vê e responde o diário de qualquer responsável, com
 * o seletor "Diário de quem". Quem é `pcm` de alguma obra da fila abre nas
 * suas; quem não é, e o administrador, abre em todos.
 *
 * "EM CAMPO" aqui é o mesmo recorte do mockup: `!posCampo(o)` — levantamento,
 * em andamento e paralisado. Obra em `definir` fica de fora de propósito: sem
 * responsável, sem equipe e sem cronograma ela não tem o que responder, e o
 * próprio mockup diz que "nenhuma delas entra no diário enquanto ficar assim".
 *
 * Server Component: busca e deriva. Quem responde é `_cartoes.tsx`, client.
 */

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { derivar, hojeISO, horaISO, type ObraRow, type Obra } from '../_lib/tipos'
import { ETAPAS_FILA_DIARIO, agendadaForaDoDiario, naFilaDoDiario } from '../_lib/agendamento'
import { chaveDoUsuario, resolverChave } from './_pessoa'
import { lerTodasAsLinhas } from '../_lib/ler-paginas'
import Cartoes, { type Autoria, type RespostaDeHoje, type TarefaDeHoje } from './_cartoes'
import type { Pessoa } from './_cartao'

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
  // As três leituras abaixo não dependem uma da outra: vão juntas (antes eram
  // idas ao banco em série).
  //
  // `obras_pessoa` é a tabela de quem pode ser dono de tarefa. É pequena (4
  // linhas semeadas + as equipes da importação) e o cartão precisa dela para
  // dizer PARA QUEM a tarefa vai antes de ela ir.
  //
  // O seletor do administrador só oferece quem tem obra em campo — lista de
  // gente sem obra é lista que ninguém escolhe. Sem filtro ele sai das próprias
  // obras lidas mais abaixo (mesmo recorte); só com filtro precisa de consulta
  // à parte, porque aí as obras lidas são só as de um responsável.
  //
  // DIÁRIO PARA TODOS (spec 27/10/2026): quem tem acesso ao módulo vê e responde
  // o diário de qualquer responsável. A guarda que falha fechada é a de cima
  // (acesso ao módulo); o filtro por `pcm` aqui é só conveniência de tela.
  // A lista do seletor só dispensa a consulta à parte quando a leitura das
  // obras já vem sem filtro (admin sem parâmetro, ou `?analista=todos`).
  const semFiltroGarantido = analista === 'todos' || (admin && !analista)
  const [minhaChave, { data: linhasPessoa }, { data: todosPcm }] = await Promise.all([
    resolverChave(supabase, email),
    supabase.from('obras_pessoa').select('chave, nome, area, email'),
    semFiltroGarantido
      ? Promise.resolve({ data: null, error: null })
      : lerTodasAsLinhas<{ pcm: string | null }>((de, ate, estavel) => {
          const q = supabase.from('obras_obra').select('pcm').eq('modalidade', 'spot').in('etapa', ETAPAS_FILA_DIARIO)
          return (estavel ? q.order('id', { ascending: true }) : q).range(de, ate)
        }),
  ])
  // `?analista` ausente → padrão da pessoa (D4): quem é `pcm` de alguma obra da
  // fila abre nas suas; quem não é, e o admin, abre em todos.
  let filtroPcm: string
  if (analista === 'todos') filtroPcm = ''
  else if (analista) filtroPcm = analista
  else if (admin) filtroPcm = ''
  else filtroPcm = minhaChave && (todosPcm ?? []).some((o) => o.pcm === minhaChave) ? minhaChave : ''

  // Em páginas: o PostgREST corta em 1.000 linhas sem avisar.
  const { data: linhas, error } = await lerTodasAsLinhas<ObraRow>((de, ate, estavel) => {
    let q = supabase.from('obras_obra').select('*').eq('modalidade', 'spot').in('etapa', ETAPAS_FILA_DIARIO)
    if (filtroPcm) q = q.eq('pcm', filtroPcm)
    return (estavel ? q.order('id', { ascending: true }) : q).range(de, ate)
  })

  if (error) return <Erro />

  const todas: Obra[] = (linhas ?? []).map((o) => derivar(o, hoje))
  // A regra da fila mora em _lib/agendamento.ts (a mesma do Painel e do e-mail).
  const obras = todas.filter((o) => naFilaDoDiario(o, hoje))
  const agendadas = todas.filter((o) => agendadaForaDoDiario(o, hoje))
  const ids = obras.map((o) => o.id)

  const nomes = new Map<string, Pessoa>(
    ((linhasPessoa ?? []) as { chave: string; nome: string; area: string | null }[]).map((p) => [
      p.chave,
      { nome: p.nome, area: p.area },
    ])
  )
  const pessoas: Record<string, Pessoa> = Object.fromEntries(nomes)
  const pessoasPorEmail = ((linhasPessoa ?? []) as { nome: string; email?: string | null }[])
    .filter((p): p is { nome: string; email: string } => !!p.email)
    .map((p) => ({ email: p.email, nome: p.nome }))

  // Quem já respondeu hoje, e as tarefas que essas respostas abriram.
  let respostas: Record<string, RespostaDeHoje> = {}
  const tarefas: Record<string, TarefaDeHoje[]> = {}
  if (ids.length) {
    const [diario, tarefasHoje] = await Promise.all([
      supabase
        .from('obras_diario')
        .select('obra_id, andou, motivo, item, obs, foto_path, registrado_por_email, atualizado_em, created_at')
        .eq('data', hoje)
        .in('obra_id', ids),
      supabase
        .from('obras_tarefa')
        .select('id, obra_id, item, dono, prazo')
        .eq('aberta', hoje)
        .in('obra_id', ids),
    ])

    // As duas consultas contam. Se a de tarefas falhar em silêncio, as obras já
    // respondidas aparecem sem o "✓ Tarefa aberta para…" — ou seja, a tela diz
    // que nada foi cobrado quando foi. Melhor a tela de erro que a mentira.
    if (diario.error || tarefasHoje.error) return <Erro />

    const pcmDa = new Map(obras.map((o) => [o.id, o.pcm]))
    respostas = Object.fromEntries(
      ((diario.data ?? []) as unknown as LinhaDiario[]).map((d) => [
        d.obra_id,
        {
          obra_id: d.obra_id,
          andou: d.andou,
          motivo: d.motivo,
          item: d.item,
          obs: d.obs,
          foto_path: d.foto_path,
          autoria: autoriaDe(d, pcmDa.get(d.obra_id) ?? null, nomes, linhasPessoa ?? []),
        },
      ])
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

  // Lista do seletor, para todos: `pcm` distintos das obras da fila.
  const fonte = todosPcm ?? linhas ?? []
  const responsaveis = Array.from(new Set(fonte.map((o) => o.pcm).filter((p): p is string => !!p))).sort()

  return (
    <Cartoes
      obras={obras}
      agendadas={agendadas}
      pessoasPorEmail={pessoasPorEmail}
      respostas={respostas}
      tarefas={tarefas}
      pessoas={pessoas}
      hoje={hoje}
      admin={admin}
      responsaveis={responsaveis}
      analistaSelecionado={filtroPcm}
      minhaChave={minhaChave}
    />
  )
}

type LinhaDiario = Omit<RespostaDeHoje, 'autoria'> & {
  registrado_por_email: string | null
  atualizado_em: string | null
  created_at: string
}

const primeiroNome = (nome: string) => nome.split(' ')[0]
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/**
 * Rótulo "Respondido por X [em nome de Y] às HH:MM" (spec 27/10/2026 §3).
 * Resposta antiga, sem e-mail, não tem rótulo. A chave de quem respondeu é a
 * mesma regra de `resolverChave` (cadastro por e-mail, senão a convenção),
 * resolvida aqui com a `obras_pessoa` já lida — sem uma ida ao banco por resposta.
 */
function autoriaDe(
  d: LinhaDiario,
  pcm: string | null,
  nomes: Map<string, Pessoa>,
  linhasPessoa: { chave: string; nome: string; email?: string | null }[]
): Autoria | null {
  const email = d.registrado_por_email
  if (!email) return null
  const cadastro = linhasPessoa.find((p) => !!p.email && p.email.toLowerCase() === email.toLowerCase())
  const por = cadastro ? primeiroNome(cadastro.nome) : capitalizar(email.split('@')[0].split('.')[0])
  const chave = cadastro?.chave ?? chaveDoUsuario(email)
  const responsavel = pcm ? nomes.get(pcm) : undefined
  const emNomeDe =
    !pcm || chave === pcm ? null : responsavel ? primeiroNome(responsavel.nome) : capitalizar(pcm)
  return { por, emNomeDe, hora: horaISO(new Date(d.atualizado_em ?? d.created_at)) }
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

/** Texto do mockup "diário para todos" (seção 4c): só para quem não tem acesso
 *  ao módulo (ou sem sessão). Sem o botão "Ver a base de obras", como no mockup. */
function SemPermissao() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-5">
        <h1 className="text-base font-semibold text-[#e8eef7]">Você não tem acesso a Gestão de Obras</h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Seu acesso não inclui este módulo, por isso o diário do dia não aparece para você.
        </p>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Se você precisa dele, peça ao administrador para incluir seu acesso.
        </p>
      </div>
    </div>
  )
}
