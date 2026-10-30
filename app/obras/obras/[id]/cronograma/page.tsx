import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { impedimentosCalcDe, planoDe } from '../../_lib/leitura'
import {
  calcularCronograma,
  compararComBase,
  deltaDiasUteis,
  resumirEtapas,
  type AtividadeCalculada,
  type Situacao,
  type StatusAtividade,
} from '../../_lib/cronograma'
import { CORES_ETAPA } from '../../_ui/tema'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import TelaCronograma from './_tela'
import type { DadosCronograma, LinhaAtividade, LinhaEtapa } from './_tipos'

export const dynamic = 'force-dynamic'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-4 py-10 text-center text-[14px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

/** Situação da linha de etapa: a pior das filhas; sem problema, andamento pelo %. */
function situacaoDaEtapa(as: AtividadeCalculada[]): { situacao: Situacao; status: StatusAtividade } {
  if (as.every((a) => a.situacao === 'concluida')) return { situacao: 'concluida', status: 'concluido' }
  for (const s of ['atrasada', 'aguardando_cliente', 'inicio_atrasado'] as const) {
    if (as.some((a) => a.situacao === s)) return { situacao: s, status: 'em_andamento' }
  }
  const andando = as.some((a) => a.status === 'em_andamento' || a.status === 'concluido' || a.percentual > 0)
  return { situacao: 'no_prazo', status: andando ? 'em_andamento' : 'nao_iniciado' }
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
  const { obra, calc, calcBase, versaoVigente, rascunho, exec, impedimentos, feriados } = r.dados

  if (!calc) {
    return (
      <Aviso>
        Esta OBRA ainda não tem cronograma.{' '}
        <Link href={`/obras/obras/${id}`} className="font-medium text-(--obra-orange-texto) underline">
          Voltar ao painel
        </Link>
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
    })
  }

  const engenheiro = obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEditar = admin || (!!engenheiro && engenheiro === email)

  const base = calcBase?.atividades ?? null
  const comp = compararComBase(exibida.atividades, base, feriados)
  // Sem peso_valor/peso no cliente: dado interno.
  const atividades: LinhaAtividade[] = exibida.atividades.map(({ pesoValor: _p, peso: _q, ...a }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const c = comp.get(a.numero)
    return { ...a, inicioBase: c?.inicioBase ?? null, fimBase: c?.fimBase ?? null, delta: c?.deltaDias ?? null }
  })

  const etapasBase = new Map(base ? resumirEtapas(base, feriados).map((e) => [e.etapa, e]) : [])
  const porNumero = new Map(exibida.atividades.map((a) => [a.numero, a]))
  const etapas: LinhaEtapa[] = resumirEtapas(exibida.atividades, feriados).map((e, i) => {
    const b = etapasBase.get(e.etapa)
    return {
      chave: e.etapa,
      nome: e.etapa || 'Sem etapa',
      cor: CORES_ETAPA[i % CORES_ETAPA.length],
      inicio: e.inicio,
      fim: e.fim,
      diasUteis: e.diasUteis,
      percentual: e.percentual,
      inicioProjetado: e.inicioProjetado,
      fimProjetado: e.fimProjetado,
      inicioBase: b?.inicio ?? null,
      fimBase: b?.fim ?? null,
      delta: b ? deltaDiasUteis(b.fim, e.fimProjetado, feriados) : null,
      ...situacaoDaEtapa(e.numeros.map((n) => porNumero.get(n)!)),
      numeros: e.numeros,
    }
  })

  const dados: DadosCronograma = {
    obraId: id,
    versao: { id: alvo.id, numero: alvo.numero, salva: !!alvo.salva_em },
    versoes: versoes.map((x) => ({
      numero: x.numero,
      rotulo:
        (x.numero === 1 ? 'Base v1' : `v${x.numero}`) +
        (!x.salva_em ? ' · rascunho' : x.id === versaoVigente?.id ? ' · vigente' : ''),
    })),
    podeEditar,
    editavel: podeEditar && !alvo.salva_em,
    rascunho: rascunho ? { id: rascunho.id, numero: rascunho.numero } : null,
    temVigente: !!versaoVigente,
    temBase: !!calcBase,
    etapas,
    atividades,
    feriados: [...feriados],
    hoje,
    termino: { base: r.dados.terminoBase, previsto: exibida.terminoPrevisto, projetado: exibida.terminoProjetado },
    statusAtividades: calc.atividades.map((a) => ({
      numero: a.numero, etapa: a.etapa, descricao: a.descricao, status: a.status, percentual: a.percentual,
      inicioPrevisto: a.inicioPrevisto, inicioReal: a.inicioReal, fimReal: a.fimReal,
      diasRestantes: a.diasRestantes, travada: a.travada,
    })),
    atividadeTrava: obra.atividade_trava ?? null,
  }

  return <TelaCronograma dados={dados} />
}
