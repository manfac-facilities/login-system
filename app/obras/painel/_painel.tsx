'use client'

/**
 * Painel gerencial — a tela. Todo número chega pronto de `_calculos.ts`,
 * calculado no servidor; aqui só há o estado de abrir/fechar listas e de
 * ordenar. Cliente, mês e comparação vão para a URL e a página recalcula.
 *
 * Layout e textos: `mockup-dashboard-gerencial-2026-09-28.html` (aprovado pelo
 * cliente). O botão "Como a planilha" do resumo saiu a pedido do cliente
 * (29/09): fica só a visão por etapa do sistema.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Painel, Sla } from './_calculos'
import { MESES_CURTOS, MESES_LONGOS } from './_calculos'
import {
  Barra,
  Card,
  CardH,
  Chevron,
  Delta,
  K,
  Mini,
  N0,
  N1,
  Posicao,
  Progresso,
  R,
  Secao,
  Seg,
  TD,
  TH,
  TabelaObras,
  Tag,
  Vazio,
  colunaValor,
  colunasObra,
  fd,
} from './_ui'
import Cronograma from './_gantt'
import Historico from './_historico'

type Props = { painel: Painel; meses: { v: string; nome: string }[] }

export default function PainelGerencial({ painel, meses }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const { periodo: P, filtro } = painel

  function ir(mudanca: Partial<{ cliente: string | null; mes: string; cmp: string }>) {
    const alvo = { ...filtro, ...mudanca }
    const q = new URLSearchParams()
    if (alvo.cliente) q.set('cliente', alvo.cliente)
    q.set('mes', alvo.mes)
    if (alvo.cmp !== 'prev') q.set('cmp', alvo.cmp)
    iniciar(() => router.push(`/obras/painel?${q.toString()}`, { scroll: false }))
  }

  const comCliente = !filtro.cliente
  const rotuloCmp =
    filtro.cmp === 'prev' ? `vs ${fd(P.pa)}–${fd(P.pb)}` : `vs ${fd(P.pa)}–${fd(P.pb)}/${P.ano - 1}`
  const posicaoMes = P.b === painel.hoje ? `Posição de hoje, ${fd(painel.hoje)}` : `Posição em ${fd(P.b)} (fim do mês)`
  const posicaoHoje = `Posição de hoje, ${fd(painel.hoje)}`

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <header className="pb-4">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#ff7849]">
          Controle de Obras · uso interno
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#e8eef7] sm:text-4xl">Painel gerencial</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#94a3b8]">
          Metas, carteira, faturamento, prazos, equipes e obras paradas. Tudo que está aqui obedece ao filtro de
          cliente e ao mês escolhidos logo abaixo.
        </p>
      </header>

      <div className="z-30 flex flex-wrap items-end gap-3.5 rounded-xl border border-[#1e3a5f] bg-[#081426f0] p-3 shadow-[0_18px_48px_rgba(0,0,0,.22)] backdrop-blur sm:sticky sm:top-2">
        <div className="w-full min-w-0 sm:w-auto">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Cliente</span>
          <Seg
            rotulo="Cliente"
            valor={filtro.cliente ?? ''}
            aoEscolher={(v) => ir({ cliente: v || null })}
            itens={[{ v: '', nome: 'Todos' }, ...painel.clientes.map((c) => ({ v: c.chave, nome: c.nome }))]}
          />
        </div>
        <label className="w-full min-w-0 sm:w-auto">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Mês</span>
          <select
            value={filtro.mes}
            onChange={(e) => ir({ mes: e.target.value })}
            className="w-full min-w-[150px] rounded-md border border-[#1e3a5f] bg-[#071225] px-2.5 py-2 text-sm text-[#e8eef7]"
          >
            {meses.map((m) => (
              <option key={m.v} value={m.v}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full min-w-0 sm:w-auto">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
            Comparar com
          </span>
          <select
            value={filtro.cmp}
            onChange={(e) => ir({ cmp: e.target.value })}
            className="w-full min-w-[150px] rounded-md border border-[#1e3a5f] bg-[#071225] px-2.5 py-2 text-sm text-[#e8eef7]"
          >
            <option value="prev">Mesmo período do mês anterior</option>
            <option value="yoy">Mesmo período do ano anterior</option>
          </select>
        </label>
        <div className="basis-full text-[12px] text-[#94a3b8] lg:ml-auto lg:basis-auto lg:text-right">
          <b className="block text-[13px] text-[#e8eef7]">
            {painel.clienteNome ?? 'Todos os clientes'} · {MESES_LONGOS[P.mes - 1]} {P.ano}
          </b>
          {fd(P.a)} a {fd(P.b)}
          {P.parcial ? ' (mês em curso)' : ''} · comparando {rotuloCmp.replace('vs ', 'com ')}
          {pendente ? <span className="ml-2 text-[#ff7849]">atualizando…</span> : null}
        </div>
      </div>

      <div className={pendente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <Metas painel={painel} rotuloCmp={rotuloCmp} posicao={posicaoMes} aoFiltrar={(c) => ir({ cliente: c })} />
        <ResumoPorEtapa painel={painel} comCliente={comCliente} posicao={posicaoHoje} />
        <Slas painel={painel} comCliente={comCliente} rotuloCmp={rotuloCmp} />
        <Equipes painel={painel} comCliente={comCliente} />
        <ParadasEAtrasos painel={painel} comCliente={comCliente} posicao={posicaoHoje} />
        <Ritmo painel={painel} />
        <Cronograma painel={painel} comCliente={comCliente} />
        <Historico painel={painel} aoEscolherMes={(m) => (meses.some((x) => x.v === m) ? ir({ mes: m }) : null)} />
      </div>
    </div>
  )
}

// ============================================================
// 1. Metas
// ============================================================

function Metas({
  painel,
  rotuloCmp,
  posicao,
  aoFiltrar,
}: {
  painel: Painel
  rotuloCmp: string
  posicao: string
  aoFiltrar: (cliente: string | null) => void
}) {
  const { kpis: k, metas, periodo: P, porCliente, filtro } = painel
  const pctPend = k.carteira.valor ? (k.pendente.valor / k.carteira.valor) * 100 : 0
  const pc = (v: number, m: number | null) =>
    m ? (
      <span style={{ color: v >= m ? '#35c98a' : '#94a3b8' }}>{N0((v / m) * 100)}%</span>
    ) : (
      <span className="text-[#64748b]">sem meta</span>
    )

  const kpi = 'min-w-0 rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4'
  const t = 'text-[10.5px] font-extrabold uppercase tracking-wider text-[#94a3b8]'
  const v = 'mt-2 mb-0.5 break-words font-mono text-[22px] font-bold tracking-tight tabular-nums sm:text-2xl'
  const s = 'text-[11.5px] text-[#94a3b8]'

  return (
    <Secao
      titulo="Metas: carteira e faturamento"
      sub="Carteira é tudo que está com a gente: a iniciar, em andamento e pendente de faturamento. Faturamento é o que teve nota fiscal emitida."
      extra={<Posicao>{posicao}</Posicao>}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={kpi}>
          <div className={t}>Carteira de obras</div>
          <div className={`${v} text-[#e8eef7]`}>{R(k.carteira.valor)}</div>
          <div className={s}>
            {k.carteira.qtd} obras com a gente
            {k.carteira.semValor ? ` · ${k.carteira.semValor} sem valor` : ''}
          </div>
          <Progresso valor={k.carteira.valor} meta={metas.carteira} />
          <Delta atual={k.carteira.valor} anterior={k.carteira.anterior} maiorMelhor rotulo={rotuloCmp} />
          <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-[#94a3b8]">
            <span>
              A iniciar <b className="font-mono font-semibold text-[#e8eef7]">{K(k.carteira.iniciar)}</b>
            </span>
            <span>
              Andamento <b className="font-mono font-semibold text-[#e8eef7]">{K(k.carteira.andamento)}</b>
            </span>
            <span>
              Pend. fat. <b className="font-mono font-semibold text-[#e8eef7]">{K(k.carteira.pendFat)}</b>
            </span>
          </div>
        </div>
        <div className={kpi}>
          <div className={t}>Faturamento do mês</div>
          <div className={`${v} text-[#e8eef7]`}>{R(k.faturamentoMes.valor)}</div>
          <div className={s}>
            NF emitida de {fd(P.a)} a {fd(P.b)}
          </div>
          <Progresso valor={k.faturamentoMes.valor} meta={metas.faturamento} />
          <Delta atual={k.faturamentoMes.valor} anterior={k.faturamentoMes.anterior} maiorMelhor rotulo={rotuloCmp} />
        </div>
        <div className={kpi}>
          <div className={t}>Faturado no ano</div>
          <div className={`${v} text-[#e8eef7]`}>{R(k.faturadoAno.valor)}</div>
          <div className={s}>
            acumulado jan–{MESES_CURTOS[P.mes - 1]}/{P.ano}
          </div>
          <Progresso
            valor={k.faturadoAno.valor}
            meta={k.faturadoAno.metaAcumulada}
            rotuloMeta={metas.faturamento ? `meta ${P.mes}×${K(metas.faturamento)}` : undefined}
          />
          <Delta
            atual={k.faturadoAno.valor}
            anterior={k.faturadoAno.anterior}
            maiorMelhor
            rotulo={`vs mesmo período de ${P.ano - 1}`}
          />
        </div>
        <div className={kpi}>
          <div className={t}>Pendente faturamento</div>
          <div className={`${v} text-[#f4b73f]`}>{R(k.pendente.valor)}</div>
          <div className={s}>{k.pendente.qtd} obras liberadas, aguardando NF</div>
          <div className="mt-2.5 mb-1.5 rounded-md border border-[#294b78] px-2 py-1 text-[11px] text-[#64748b]">
            Parte da carteira: {N0(pctPend)}% do total
          </div>
          <Delta atual={k.pendente.valor} anterior={k.pendente.anterior} maiorMelhor={false} rotulo={rotuloCmp} />
        </div>
      </div>

      <Card className="mt-3.5">
        <CardH
          titulo="Quanto cada cliente representa"
          sub="Clique num cliente para filtrar a tela inteira. A linha Todos é a soma, e as metas somam junto."
        />
        <p className="border-b border-[#1e3a5f] px-3 py-2 text-[11px] text-[#ff7849] sm:hidden">
          Arraste a tabela para o lado para ver todas as colunas →
        </p>
        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={TH}>Cliente</th>
                <th className={`${TH} text-right`}>Carteira</th>
                <th className={`${TH} text-right`}>% meta</th>
                <th className={`${TH} text-right`}>Faturado no mês</th>
                <th className={`${TH} text-right`}>% meta</th>
                <th className={`${TH} text-right`}>Faturado no ano</th>
                <th className={`${TH} text-right`}>Pendente faturamento</th>
              </tr>
            </thead>
            <tbody>
              {[...porCliente.linhas, porCliente.total].map((l) => {
                const total = l === porCliente.total
                const sel = total ? !filtro.cliente : filtro.cliente === l.chave
                return (
                  <tr
                    key={l.chave || 'todos'}
                    onClick={() => aoFiltrar(total ? null : l.chave)}
                    className={
                      'cursor-pointer hover:[&>td]:bg-[#0d20508c] ' +
                      (sel ? '[&>td]:bg-[#f05a2817] ' : '') +
                      (total ? 'font-extrabold [&>td]:border-t-2 [&>td]:border-t-[#294b78]' : '')
                    }
                  >
                    <td className={TD}>
                      <b>{l.nome}</b>
                    </td>
                    <td className={`${TD} text-right font-mono`}>{R(l.carteira)}</td>
                    <td className={`${TD} text-right`}>{pc(l.carteira, l.metaCarteira)}</td>
                    <td className={`${TD} text-right font-mono`}>{R(l.faturadoMes)}</td>
                    <td className={`${TD} text-right`}>{pc(l.faturadoMes, l.metaFaturamento)}</td>
                    <td className={`${TD} text-right font-mono`}>{R(l.faturadoAno)}</td>
                    <td className={`${TD} text-right font-mono`}>
                      {R(l.pendente)} <span className="text-[11px] text-[#64748b]">({l.pendenteQtd})</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Secao>
  )
}

// ============================================================
// 2. Resumo por etapa (posição de hoje)
// ============================================================

function ResumoPorEtapa({ painel, comCliente, posicao }: { painel: Painel; comCliente: boolean; posicao: string }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const { linhas, total } = painel.resumo
  return (
    <Secao
      titulo="Resumo por status"
      sub="Quantidade e valor em cada etapa do sistema. Clique numa linha para abrir a lista de obras."
      extra={<Posicao>{posicao}</Posicao>}
    >
      <Card>
        <div className="max-w-full overflow-auto">
          <table className="w-full border-collapse text-[12.5px] sm:min-w-[560px]">
            <thead>
              <tr>
                <th className={TH}>Etapa</th>
                <th className={`${TH} text-right`}>Qtd</th>
                <th className={`${TH} text-right`}>Valor total</th>
                <th className={`${TH} hidden sm:table-cell`}>Participação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const open = aberta === l.etapa
                return (
                  <Fragment key={l.etapa}>
                    <tr
                      onClick={() => setAberta(open ? null : l.etapa)}
                      className={`cursor-pointer hover:[&>td]:bg-[#0d20508c] ${open ? '[&>td]:bg-[#f05a2817]' : ''}`}
                    >
                      <td className={`${TD} whitespace-normal`}>
                        <Chevron aberto={open} />
                        {l.nome}
                      </td>
                      <td className={`${TD} text-right font-mono`}>{l.qtd}</td>
                      <td className={`${TD} text-right font-mono`}>{R(l.valor)}</td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        <Barra pct={total.valor ? (l.valor / total.valor) * 100 : 0} />
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={4} className="bg-[#081527] p-0">
                          <div className="px-3 pb-3.5 pt-2.5">
                            <TabelaObras
                              linhas={l.obras}
                              colunas={[
                                ...colunasObra<(typeof l.obras)[number]>(comCliente),
                                { rotulo: 'Etapa no sistema', render: (x) => x.obra.etapaNome },
                                colunaValor(),
                                { rotulo: 'Dias na etapa', dir: true, render: (x) => x.diasNaEtapa ?? '—' },
                              ]}
                            />
                            {l.obras.length ? (
                              <p className="mt-2 text-[11px] text-[#64748b]">
                                {l.obras.length} obras, da mais antiga na etapa para a mais recente.
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
              <tr className="font-extrabold [&>td]:border-t-2 [&>td]:border-t-[#294b78] [&>td]:bg-[#0d205080]">
                <td className={`${TD} whitespace-normal`}>Total geral = carteira</td>
                <td className={`${TD} text-right font-mono`}>{total.qtd}</td>
                <td className={`${TD} text-right font-mono`}>{R(total.valor)}</td>
                <td className={`${TD} hidden text-[11px] font-normal text-[#64748b] sm:table-cell`}>
                  {total.semValor ? `${total.semValor} obras sem valor informado` : posicao}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </Secao>
  )
}

// ============================================================
// 3. SLAs
// ============================================================

function Slas({ painel, comCliente, rotuloCmp }: { painel: Painel; comCliente: boolean; rotuloCmp: string }) {
  return (
    <Secao
      titulo="Prazos de resposta (SLA)"
      sub="Média e pior caso das obras que concluíram a etapa no mês, e o que ainda está esperando agora."
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <CartaoSla
          titulo="Pendente faturamento → NF emitida"
          sub="Dias entre a liberação para faturar e a emissão da nota"
          sla={painel.slaPendFat}
          comCliente={comCliente}
          rotuloCmp={rotuloCmp}
          hoje={painel.hoje}
        />
        <CartaoSla
          titulo="Liberação para executar → OS aprovada"
          sub="Dias entre a obra ser liberada e o cliente aprovar a OS"
          sla={painel.slaOS}
          comCliente={comCliente}
          rotuloCmp={rotuloCmp}
          hoje={painel.hoje}
        />
      </div>
    </Secao>
  )
}

function CartaoSla({
  titulo,
  sub,
  sla,
  comCliente,
  rotuloCmp,
  hoje,
}: {
  titulo: string
  sub: string
  sla: Sla
  comCliente: boolean
  rotuloCmp: string
  hoje: string
}) {
  const [aberto, setAberto] = useState(false)
  const mx = Math.max(1, ...sla.faixas.map((f) => f.qtd))
  const esp = sla.esperando
  return (
    <Card>
      <CardH titulo={titulo} sub={sub} />
      <div className="px-4 py-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Mini
            rotulo="Média"
            valor={
              <>
                {sla.media !== null ? N1(sla.media) : '—'} <span className="text-[13px] text-[#94a3b8]">dias</span>
              </>
            }
          >
            <div className="text-[11.5px] text-[#94a3b8]">{sla.concluidas.length} obras concluíram a etapa no mês</div>
            {sla.media !== null && sla.mediaAnterior !== null ? (
              <Delta atual={sla.media} anterior={sla.mediaAnterior} maiorMelhor={false} rotulo={rotuloCmp} />
            ) : null}
          </Mini>
          <Mini
            rotulo="Pior caso"
            cor="#ff4d6d"
            valor={
              <>
                {sla.pior ? sla.pior.dias : '—'} <span className="text-[13px] text-[#94a3b8]">dias</span>
              </>
            }
          >
            <div className="break-words text-[11.5px] text-[#94a3b8]">
              {sla.pior ? (
                <>
                  <span className="font-mono text-[11px] text-[#64748b]">{sla.pior.obra.os}</span> · {sla.pior.obra.loja}
                </>
              ) : (
                'nenhuma obra no mês'
              )}
            </div>
            {sla.pior ? (
              <div className="mt-1.5 break-words text-[11px] text-[#64748b]">
                {sla.pior.obra.cliente} · {sla.pior.obra.semValor ? 'sem valor' : R(sla.pior.obra.valor)}
              </div>
            ) : null}
          </Mini>
        </div>
        <div className="mt-3.5 grid gap-1.5">
          {sla.faixas.map((f) => (
            <div key={f.rotulo} className="grid grid-cols-[70px_1fr_62px] items-center gap-2.5 text-[11.5px] text-[#94a3b8] sm:grid-cols-[86px_1fr_70px]">
              <span>{f.rotulo}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#071225]">
                <i className="block h-full rounded-full" style={{ width: `${(f.qtd / mx) * 100}%`, backgroundColor: f.cor }} />
              </div>
              <strong className="text-right font-mono text-[12px] text-[#e8eef7]">{f.qtd} obras</strong>
            </div>
          ))}
        </div>
        <div className="mt-3.5 border-t border-[#1e3a5f] pt-3 text-[12px] text-[#94a3b8]">
          Ainda esperando hoje ({fd(hoje)}):{' '}
          <b className="text-[#e8eef7]">
            {esp.qtd} obras · {R(esp.valor)}
          </b>
          {esp.maisAntiga ? (
            <>
              {' '}
              · a mais antiga espera há <b className="text-[#ff4d6d]">{esp.maisAntiga.dias} dias</b> (
              <span className="font-mono text-[11px] text-[#64748b]">{esp.maisAntiga.obra.os}</span> ·{' '}
              {esp.maisAntiga.obra.loja})
            </>
          ) : null}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            className="rounded-md border border-[#294b78] px-2.5 py-1 text-[11.5px] font-bold text-[#ff7849] hover:border-[#f05a28]"
          >
            {aberto ? 'Fechar lista' : 'Ver obras do mês, da mais lenta para a mais rápida'}
          </button>
        </div>
        {aberto ? (
          <div className="mt-2.5">
            <TabelaObras
              linhas={sla.concluidas}
              colunas={[
                ...colunasObra<Sla['concluidas'][number]>(comCliente, { equipe: false }),
                colunaValor(),
                { rotulo: 'Dias', dir: true, render: (x) => x.dias },
              ]}
            />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

// ============================================================
// 4. Equipes
// ============================================================

function Equipes({ painel, comCliente }: { painel: Painel; comCliente: boolean }) {
  const [ordem, setOrdem] = useState<'receita' | 'prod'>('receita')
  const [aberta, setAberta] = useState<string | null>(null)
  const { linhas, total } = painel.equipes
  const P = painel.periodo
  const chave = (l: (typeof linhas)[number]) => (ordem === 'prod' ? (l.produtividade ?? 0) : l.receita)
  const ord = linhas.slice().sort((a, b) => chave(b) - chave(a))
  const mx = Math.max(1, ...ord.map(chave))
  return (
    <Secao
      titulo="Equipes: receita, dias e produtividade"
      sub="Clique numa equipe para ver quantos dias ela ficou em cada obra."
      extra={
        <Seg
          pequeno
          rotulo="Ordenar ranking"
          valor={ordem}
          aoEscolher={(v) => setOrdem(v as 'receita' | 'prod')}
          itens={[
            { v: 'receita', nome: 'Ranking por receita' },
            { v: 'prod', nome: 'Ranking por produtividade' },
          ]}
        />
      }
    >
      <Card>
        <p className="border-b border-[#1e3a5f] px-3 py-2 text-[11px] text-[#ff7849] sm:hidden">
          Arraste a tabela para o lado para ver produtividade e dias →
        </p>
        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={TH}>#</th>
                <th className={TH}>Equipe</th>
                <th className={`${TH} text-right`}>Receita (R$ executado)</th>
                <th className={`${TH} text-right`}>Obras concluídas</th>
                <th className={`${TH} text-right`}>Dias nessas obras</th>
                <th className={`${TH} text-right`}>Produtividade (R$/dia)</th>
                <th className={`${TH} text-right`}>Dias no mês</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {!ord.length ? (
                <tr>
                  <td colSpan={8}>
                    <Vazio>Nenhuma equipe trabalhou para este filtro no mês.</Vazio>
                  </td>
                </tr>
              ) : null}
              {ord.map((e, i) => {
                const open = aberta === e.chave
                return (
                  <Fragment key={e.chave}>
                    <tr
                      onClick={() => setAberta(open ? null : e.chave)}
                      className={`cursor-pointer hover:[&>td]:bg-[#0d20508c] ${open ? '[&>td]:bg-[#f05a2817]' : ''}`}
                    >
                      <td className={`${TD} font-mono font-extrabold`} style={{ color: i === 0 ? '#ff7849' : '#94a3b8' }}>
                        {i + 1}º
                      </td>
                      <td className={TD}>
                        <Chevron aberto={open} />
                        <b>{e.nome}</b>
                      </td>
                      <td className={`${TD} text-right font-mono`}>
                        {R(e.receita)}
                        {e.receita || e.receitaAnterior ? (
                          <>
                            <br />
                            <Delta atual={e.receita} anterior={e.receitaAnterior} maiorMelhor rotulo="" />
                          </>
                        ) : null}
                      </td>
                      <td className={`${TD} text-right font-mono`}>{e.obrasConcluidas}</td>
                      <td className={`${TD} text-right font-mono`}>{e.diasNessasObras}</td>
                      <td className={`${TD} text-right font-mono`}>
                        <b>{e.produtividade !== null ? R(e.produtividade) : '—'}</b>
                      </td>
                      <td className={`${TD} text-right font-mono`}>{e.diasNoMes}</td>
                      <td className={TD}>
                        <Barra className="w-[110px]" cor="#f05a28" pct={(chave(e) / mx) * 100} />
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={8} className="bg-[#081527] p-0">
                          <div className="px-3 pb-3.5 pt-2.5">
                            <TabelaObras
                              linhas={e.obras}
                              colunas={[
                                ...colunasObra<(typeof e.obras)[number]>(comCliente, { equipe: false }),
                                {
                                  rotulo: 'Situação',
                                  render: (x) =>
                                    x.situacao === 'concluida' ? (
                                      <Tag cor="#35c98a">concluída no mês</Tag>
                                    ) : x.situacao === 'antes' ? (
                                      <Tag cor="#35c98a">concluída antes</Tag>
                                    ) : (
                                      <Tag cor="#5aa9f0">em execução</Tag>
                                    ),
                                },
                                { rotulo: 'Dias no mês', dir: true, render: (x) => x.diasNoMes },
                                { rotulo: 'Dias na obra (total)', dir: true, render: (x) => x.diasTotal },
                                colunaValor(),
                              ]}
                            />
                            <p className="mt-2 text-[11px] text-[#64748b]">
                              Total do mês: <b className="text-[#e8eef7]">{e.diasNoMes} dias trabalhados</b> em{' '}
                              {e.obras.length} obras.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
              {ord.length ? (
                <tr className="font-extrabold [&>td]:border-t-2 [&>td]:border-t-[#294b78] [&>td]:bg-[#0d205080]">
                  <td className={TD}></td>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right font-mono`}>{R(total.receita)}</td>
                  <td className={`${TD} text-right font-mono`}>{total.obrasConcluidas}</td>
                  <td className={`${TD} text-right font-mono`}>{total.diasNessasObras}</td>
                  <td className={`${TD} text-right font-mono`}>
                    {total.produtividade !== null ? R(total.produtividade) : '—'}
                  </td>
                  <td className={`${TD} text-right font-mono`}>{total.diasNoMes}</td>
                  <td className={TD}></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3.5">
          <div className="mt-3 rounded-lg border border-dashed border-[#294b78] px-3 py-2.5 text-[12px] text-[#94a3b8]">
            <b className="text-[#e8eef7]">Como a conta é feita.</b> A receita de uma obra entra no mês em que a execução
            terminou. Produtividade = receita ÷ dias trabalhados nessas obras (dias em que o diário marcou
            &quot;andou&quot;). &quot;Dias no mês&quot; soma todos os dias trabalhados em {MESES_LONGOS[P.mes - 1].toLowerCase()},
            inclusive em obras que ainda não terminaram. A equipe é a que está gravada na obra.
          </div>
        </div>
      </Card>
    </Secao>
  )
}

// ============================================================
// 5. Paradas e atrasos (posição de hoje)
// ============================================================

function ParadasEAtrasos({ painel, comCliente, posicao }: { painel: Painel; comCliente: boolean; posicao: string }) {
  const [motivo, setMotivo] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<string | null>(null)
  const { paradas: p, atrasos: a } = painel
  const mx = Math.max(1, ...p.motivos.map((m) => m.valor))
  const sel = p.motivos.find((m) => m.motivo === motivo)
  const selC = a.categorias.find((c) => c.k === categoria)
  return (
    <Secao
      titulo="Obras paradas e atrasadas"
      sub="Por que as obras pararam, quanto valor está travado, e quanto das obras em andamento está fora do prazo."
      extra={<Posicao>{posicao}</Posicao>}
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <CardH
            titulo="Paradas, por motivo"
            sub={`${p.qtd} obras paradas · ${R(p.valor)} travados · clique num motivo para ver as obras`}
          />
          <div className="px-4 py-3.5">
            {p.motivos.length ? (
              <div className="grid gap-1">
                {p.motivos.map((m) => {
                  const on = motivo === m.motivo
                  return (
                    <button
                      key={m.motivo}
                      type="button"
                      onClick={() => setMotivo(on ? null : m.motivo)}
                      className={
                        'grid w-full grid-cols-[minmax(0,1fr)_34px_84px_14px] items-center gap-2.5 rounded-lg border px-2 py-2 text-left text-[12.5px] hover:border-[#294b78] hover:bg-[#0d205080] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_44px_92px_18px] ' +
                        (on ? 'border-[#294b78] bg-[#0d205080]' : 'border-transparent')
                      }
                    >
                      <span>{m.motivo}</span>
                      <span className="hidden h-[9px] overflow-hidden rounded-full bg-[#071225] sm:block">
                        <i className="block h-full rounded-full bg-[#f4b73f]" style={{ width: `${(m.valor / mx) * 100}%` }} />
                      </span>
                      <span className="text-right font-mono text-[12px]">{m.obras.length}</span>
                      <span className="text-right font-mono text-[12px] text-[#94a3b8]">{K(m.valor)}</span>
                      <Chevron aberto={on} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <Vazio>Nenhuma obra parada hoje.</Vazio>
            )}
            {sel ? (
              <div className="mt-2.5">
                <TabelaObras
                  linhas={sel.obras}
                  colunas={[
                    ...colunasObra<(typeof sel.obras)[number]>(comCliente),
                    { rotulo: 'Parada desde', render: (x) => fd(x.desde) },
                    { rotulo: 'Dias parada', dir: true, render: (x) => x.dias ?? '—' },
                    colunaValor(),
                  ]}
                />
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardH titulo="Atrasadas e remarcadas" sub={`${a.emCampo} obras em andamento (em execução ou paradas) hoje`} />
          <div className="px-4 py-3.5">
            {a.emCampo ? (
              <>
                <div className="flex gap-2.5">
                  <Mini rotulo="Atrasadas" valor={`${N0(a.pctAtrasadas)}%`} cor="#ff4d6d" className="flex-1">
                    <div className="text-[11.5px] text-[#94a3b8]">
                      {a.atrasadas} de {a.emCampo} obras passaram do fim previsto
                    </div>
                  </Mini>
                  <Mini rotulo="Remarcadas" valor={`${N0(a.pctRemarcadas)}%`} cor="#f4b73f" className="flex-1">
                    <div className="text-[11.5px] text-[#94a3b8]">
                      {a.remarcadas} de {a.emCampo} tiveram remarcação
                    </div>
                  </Mini>
                </div>
                <div className="mb-2.5 mt-3.5 flex h-4 overflow-hidden rounded-full bg-[#071225]">
                  {a.categorias.map((c) =>
                    c.obras.length ? (
                      <button
                        key={c.k}
                        type="button"
                        title={`${c.nome}: ${c.obras.length}`}
                        aria-label={`${c.nome}: ${c.obras.length}`}
                        onClick={() => setCategoria(categoria === c.k ? null : c.k)}
                        className="h-full min-w-[3px]"
                        style={{ flex: c.obras.length, backgroundColor: c.cor }}
                      />
                    ) : null
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.categorias.map((c) => (
                    <button
                      key={c.k}
                      type="button"
                      onClick={() => setCategoria(categoria === c.k ? null : c.k)}
                      className={
                        'rounded-full border bg-[#071225] px-2.5 py-1 text-[11px] ' +
                        (categoria === c.k ? 'border-[#f05a28] text-white' : 'border-[#1e3a5f] text-[#94a3b8]')
                      }
                    >
                      <i className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.cor }} />
                      {c.nome} · {c.obras.length}
                    </button>
                  ))}
                </div>
                {selC ? (
                  <div className="mt-3">
                    <TabelaObras
                      linhas={selC.obras}
                      colunas={[
                        ...colunasObra<(typeof selC.obras)[number]>(comCliente),
                        { rotulo: 'Fim previsto', render: (x) => fd(x.fimPrevisto) },
                        { rotulo: 'Dias de atraso', dir: true, render: (x) => x.diasAtraso },
                        { rotulo: 'Remarcação', render: (x) => x.remarcacao ?? '—' },
                      ]}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-[#64748b]">Clique numa faixa para ver as obras.</p>
                )}
              </>
            ) : (
              <Vazio>Nenhuma obra em andamento hoje.</Vazio>
            )}
          </div>
        </Card>
      </div>
    </Secao>
  )
}

// ============================================================
// 6. Ritmo do campo (sempre hoje)
// ============================================================

function Ritmo({ painel }: { painel: Painel }) {
  const r = painel.ritmo
  const n = 'text-[11.5px] text-[#94a3b8]'
  const d = 'mt-1.5 text-[11px] text-[#64748b]'
  return (
    <Secao
      titulo="Ritmo do campo e respostas"
      sub="Diário e tarefas mostram o que aconteceu e o que continua esperando alguém."
      extra={<Posicao>Sempre hoje · segue só o filtro de cliente</Posicao>}
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,.75fr)]">
        <Card>
          <CardH titulo="Diário de hoje" sub="Somente obras que entram na fila do diário" />
          <div className="grid grid-cols-3 gap-1.5 px-4 py-3.5 sm:gap-2">
            <Mini rotulo="Responderam" valor={`${r.responderam}/${r.esperados}`}>
              <div className={n}>registros esperados</div>
              <div className={d}>{Math.max(0, r.esperados - r.responderam)} ainda aguardam resposta</div>
            </Mini>
            <Mini rotulo="Não andou" valor={r.naoAndou} cor="#f4b73f">
              <div className={n}>registros de hoje</div>
              <div className={d}>motivo e responsável visíveis</div>
            </Mini>
            <Mini rotulo="Com foto" valor={r.comFoto} cor="#35c98a">
              <div className={n}>registros de hoje</div>
              <div className={d}>foto é evidência, não % de avanço</div>
            </Mini>
          </div>
        </Card>
        <Card>
          <CardH titulo="Tarefas" sub="Tarefas das obras do filtro" />
          <div className="grid grid-cols-3 gap-1.5 px-4 py-3.5 sm:gap-2">
            <Mini rotulo="Abertas" valor={r.abertas}>
              <div className={n}>aguardando resposta</div>
            </Mini>
            <Mini rotulo="Vencidas" valor={r.vencidas} cor="#ff4d6d">
              <div className={n}>prazo já passou</div>
            </Mini>
            <Mini rotulo="Respondidas" valor={r.respondidas7} cor="#35c98a">
              <div className={n}>nos últimos 7 dias</div>
            </Mini>
          </div>
        </Card>
      </div>
    </Secao>
  )
}
