import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import { codigosDeAtividades } from '../../_lib/cronograma'
import { lookahead } from '../../_lib/last-planner'
import { lerRestricoes } from '../../_lib/leitura'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import Quadro, { type CartaoRestricao } from './_quadro'
import RestricaoForm from './_restricao-form'
import PlanoDaSemana from './_plano'
import { RESPONSAVEIS_RESTRICAO, agruparQuadro, rotuloResponsavelRestricao, rotuloTipo } from './_tipos'

export const dynamic = 'force-dynamic'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export default async function LookaheadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string; semana?: string; semanas?: string; resp?: string; atrasadas?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const r = await lerObraDaRequisicao(id, hoje)
  if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>
  const { calc, feriados } = r.dados
  if (!calc) return <EstadoVazio>A obra ainda não tem cronograma.</EstadoVazio>
  const rr = await lerRestricoes(supabase, id)
  if (!rr.ok) return <EstadoVazio>{rr.erro}</EstadoVazio>

  const aba = sp.aba === 'quadro' || sp.aba === 'plano' ? sp.aba : 'lookahead'
  const n = sp.semanas === '3' ? 3 : sp.semanas === '6' ? 6 : 4
  const base = `/obras/obras/${id}/lookahead`
  const codigos = codigosDeAtividades(calc.atividades, feriados)
  const nomes = new Map(calc.atividades.map((a) => [a.numero, `${codigos.get(a.numero) ?? ''} ${a.descricao}`.trim()]))
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`

  const abas = (
    <nav aria-label="Seções do lookahead" className="flex flex-wrap gap-2">
      <Link href={base} className={chip(aba === 'lookahead')}>Lookahead</Link>
      <Link href={`${base}?aba=quadro`} className={chip(aba === 'quadro')}>Quadro</Link>
      <Link href={`${base}?aba=plano`} className={chip(aba === 'plano')}>Plano da semana</Link>
    </nav>
  )

  if (aba === 'plano') {
    return (
      <div className="flex flex-col gap-4">
        {abas}
        <section id="plano-da-semana" aria-label="Plano da semana">
          <PlanoDaSemana
            supabase={supabase}
            obraId={id}
            dados={r.dados}
            hoje={hoje}
            semanaParam={sp.semana}
            podeEditar={admin || (!!r.dados.obra.engenheiro_email && r.dados.obra.engenheiro_email.trim().toLowerCase() === email)}
            base={base}
          />
        </section>
      </div>
    )
  }

  if (aba === 'quadro') {
    const resp = RESPONSAVEIS_RESTRICAO.find((x) => x.valor === sp.resp)?.valor ?? null
    const atrasadas = sp.atrasadas === '1'
    const grupos = agruparQuadro(rr.restricoes, { responsavel: resp, atrasadas, hoje })
    const cartao = (x: (typeof rr.restricoes)[number]): CartaoRestricao => ({
      ...x,
      atividade: nomes.get(x.atividadeNumero) ?? `Atividade ${x.atividadeNumero}`,
      podeApagar: admin || x.criadoPor?.trim().toLowerCase() === email,
      atrasada: x.situacao !== 'liberada' && x.prazo !== null && x.prazo < hoje,
    })
    const colunas = {
      identificada: grupos.identificada.map(cartao),
      em_tratativa: grupos.em_tratativa.map(cartao),
      liberada: grupos.liberada.map(cartao),
    }
    const q = (resp2: string | null, atr: boolean) => {
      const p = new URLSearchParams({ aba: 'quadro' })
      if (resp2) p.set('resp', resp2)
      if (atr) p.set('atrasadas', '1')
      return `${base}?${p.toString()}`
    }
    return (
      <div className="flex flex-col gap-4">
        {abas}
        <nav aria-label="Filtrar o quadro" className="flex flex-wrap gap-2">
          <Link href={q(null, atrasadas)} className={chip(!resp)}>Todos</Link>
          {RESPONSAVEIS_RESTRICAO.map((x) => (
            <Link key={x.valor} href={q(x.valor, atrasadas)} className={chip(resp === x.valor)}>{x.rotulo}</Link>
          ))}
          <Link href={q(resp, !atrasadas)} className={chip(atrasadas)}>Só atrasadas</Link>
        </nav>
        <Quadro colunas={colunas} />
      </div>
    )
  }

  const semanas = lookahead(calc.atividades, rr.restricoes, hoje, n, codigos)
  return (
    <div className="flex flex-col gap-4">
      {abas}
      <nav aria-label="Janela do lookahead" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[#5a7380]">Semanas à frente:</span>
        {([3, 4, 6] as const).map((x) => (
          <Link key={x} href={`${base}?semanas=${x}`} className={chip(n === x)}>{x}</Link>
        ))}
      </nav>
      {semanas.map((s, i) => (
        <section key={s.segunda} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[#00345e]">
            {i === 0 ? 'Esta semana' : `Semana de ${dm(s.segunda)}`}
            {i === 0 ? ` (${dm(s.segunda)})` : ''}
          </h3>
          {s.itens.length === 0 ? <p className="text-sm text-[#5a7380]">Nada previsto para iniciar.</p> : null}
          <ul className="flex flex-col gap-2">
            {s.itens.map((it) => (
              <li key={it.numero} className="flex flex-wrap items-start gap-3 rounded-xl border border-[#dadad8] bg-white p-3">
                <div className="min-w-0 flex-1 text-sm text-[#333336]">
                  <p className="font-semibold text-[#00345e]">{`${it.codigo} ${it.nome}`.trim()}</p>
                  <p className="text-xs text-[#5a7380]">
                    {dm(it.inicio)} a {dm(it.termino)}
                  </p>
                  {it.restricoesAbertas.length ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {it.restricoesAbertas.map((x) => (
                        <li key={x.id} className="text-xs text-[#b23232]">
                          {rotuloTipo(x.tipo)} ({rotuloResponsavelRestricao(x.responsavel)}): {x.descricao}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    it.pronta ? 'border-[#136c38] text-[#136c38]' : 'border-[#b23232] text-[#b23232]'
                  }`}
                >
                  {it.pronta ? 'Pronta' : 'Com restrição'}
                </span>
                <RestricaoForm obraId={id} numero={it.numero} codigo={it.codigo} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
