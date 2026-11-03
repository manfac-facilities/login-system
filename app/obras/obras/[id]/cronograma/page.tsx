import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { impedimentosCalcDe, planoDe } from '../../_lib/leitura'
import { calcularCronograma } from '../../_lib/cronograma'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import TelaCronograma from './_tela'
import CriarCronograma from './_criar-cronograma'
import { montarDadosCronograma } from './_dados'

export const dynamic = 'force-dynamic'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-4 py-10 text-center text-[14px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

export default async function CronogramaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const { id } = await params
  const { v } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''

  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = admin || (!!email && (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <Aviso>Esta tela é de quem é responsável pelas obras</Aviso>

  const hoje = hojeISO()
  const r = await lerObraDaRequisicao(id, hoje)
  if (!r.ok) return <Aviso>{r.erro}</Aviso>
  const { obra, calc, versaoVigente, rascunho, exec, impedimentos, feriados } = r.dados

  const engenheiro = obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEditar = admin || (!!engenheiro && engenheiro === email)

  if (!calc) {
    return (
      <Aviso>
        Esta OBRA ainda não tem cronograma.{' '}
        <Link href={`/obras/obras/${id}`} className="font-medium text-(--obra-orange-texto) underline">
          Voltar ao painel
        </Link>
        {podeEditar ? <CriarCronograma obraId={id} /> : null}
      </Aviso>
    )
  }

  const { data: versoesR, error: errV } = await supabase
    .from('obras_cronograma_versao')
    .select('id, numero, motivo, salva_em')
    .eq('obra_id', id)
    .order('numero')
  if (errV) return <Aviso>Não deu para carregar as versões. Recarregue a página.</Aviso>
  const versoes = ((versoesR ?? []) as Linha[]).slice().sort((a, b) => a.numero - b.numero)

  // Padrão: o rascunho (é o que se edita); senão a vigente. `?v=N` mostra outra.
  const usada = versaoVigente ?? rascunho
  const padrao = rascunho ?? versaoVigente
  const alvo = versoes.find((x) => String(x.numero) === v) ?? versoes.find((x) => x.id === padrao?.id)
  if (!alvo) return <Aviso>Versão não encontrada.</Aviso>

  let exibida = calc
  if (alvo.id !== usada?.id) {
    // A leitura da obra só traz a vigente e a base; outra versão vem aqui.
    const { data: at, error } = await supabase.from('obras_atividade').select('*').eq('versao_id', alvo.id)
    if (error) return <Aviso>Não deu para carregar esta versão. Recarregue a página.</Aviso>
    exibida = calcularCronograma({
      plano: planoDe((at ?? []) as Linha[], alvo.id), exec, dataBase: obra.data_base ?? hoje, hoje, feriados,
      atividadeTrava: obra.atividade_trava, impedimentos: impedimentosCalcDe(impedimentos),
      criterioPeso: r.dados.criterioPeso,
    })
  }

  const dados = montarDadosCronograma({
    obraDados: r.dados,
    exibida,
    alvo: { id: alvo.id, numero: alvo.numero, salva: !!alvo.salva_em },
    versoes: versoes.map((x) => ({ id: x.id, numero: x.numero, salva: !!x.salva_em })),
    podeEditar,
    hoje,
  })

  return <TelaCronograma dados={dados} />
}
