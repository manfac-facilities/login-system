'use client'

/**
 * Bloco "Financeiro da OS" da ficha do SPOT. Render dos dados já lidos no servidor
 * (`lerFinanceiroSpot`); só as sub-abas e os botões de locação têm estado.
 * Links para outros sistemas são <a> (apps separadas no mesmo domínio).
 */

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { brl, pctTexto } from '../../../obras/_lib/financeiro-tela'
import { avisoLocacao, textoAviso } from '../../../obras/_lib/locacao'
import { diaBr } from '../../../obras/_lib/restricao-pedido'
import type { OrigemCusto } from '../../../obras/_lib/financeiro-obra'
import type { FinanceiroSpot } from './dados'
import { marcarDevolvidaSpotAction, renovarLocacaoSpotAction } from './_actions'

type Ok = Extract<FinanceiroSpot, { ok: true }>

const ABAS = ['Resumo', 'Compras', 'Fornecedores', 'Pagamentos e caixinha', 'Locações', 'Faturamento'] as const
type Aba = (typeof ABAS)[number]

const th = 'px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]'
const td = 'px-2 py-1.5 align-top text-sm text-[#e8eef7]'
const num = td + ' text-right whitespace-nowrap font-mono'
const botao = 'min-h-11 rounded-lg border border-[#1e3a5f] px-3 text-sm font-medium text-[#e8eef7] hover:border-[#f05a28] disabled:opacity-45'
const data = (v: string | null) => (v ? diaBr(v) : '—')

const Tabela = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[560px] border-collapse">{children}</table>
  </div>
)
const Vazio = () => <p className="text-sm text-[#94a3b8]">Sem lançamentos.</p>
const Falha = () => <p role="alert" className="text-sm text-[#f87171]">Não deu para ler estes dados agora. Recarregue em instantes.</p>

function Total({ rotulo, valor, sub }: { rotulo: string; valor: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-[#1e3a5f] bg-[#0a1628] px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-[#94a3b8]">{rotulo}</span>
      <span className="font-mono text-lg font-semibold text-[#e8eef7]">{valor}</span>
      {sub ? <span className="text-xs text-[#94a3b8]">{sub}</span> : null}
    </div>
  )
}

const ORIGENS: { id: OrigemCusto; rotulo: string }[] = [
  { id: 'compras', rotulo: 'Compras (pedidos)' },
  { id: 'fornecedores', rotulo: 'Fornecedores (medições)' },
  { id: 'pagamentos', rotulo: 'Pagamentos / rateio no Financeiro' },
  { id: 'caixinha', rotulo: 'Caixinha' },
  { id: 'locacoes', rotulo: 'Locações' },
]

function TabelaOrigens({ d, ids }: { d: Ok; ids: OrigemCusto[] }) {
  const origens = d.fin.resumo.ok ? d.fin.resumo.dados.origens : null
  if (!origens) return <Falha />
  return (
    <Tabela>
      <thead>
        <tr className="border-b border-[#1e3a5f]">
          <th className={th}>Origem</th>
          <th className={th + ' text-right'}>Comprometido</th>
          <th className={th + ' text-right'}>Realizado</th>
          <th className={th + ' text-right'}>Pago</th>
        </tr>
      </thead>
      <tbody>
        {ORIGENS.filter((o) => ids.includes(o.id)).map((o) => (
          <tr key={o.id} className="border-b border-[#1e3a5f]">
            <td className={td}>{o.rotulo}</td>
            <td className={num}>{brl(origens[o.id].comprometido)}</td>
            <td className={num}>{brl(origens[o.id].realizado)}</td>
            <td className={num}>{brl(origens[o.id].pago)}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )
}

function Resumo({ d }: { d: Ok }) {
  const r = d.resumo
  return (
    <div className="flex flex-col gap-3">
      <TabelaOrigens d={d} ids={ORIGENS.map((o) => o.id)} />
      <p className="text-sm text-[#94a3b8]">
        Margem realizada: <span className="font-mono text-[#e8eef7]">{brl(r.margemRealizadaCentavos)}</span>
        {r.margemRealizadaPct === null ? '' : ` (${pctTexto(r.margemRealizadaPct)})`}
      </p>
    </div>
  )
}

function Compras({ d }: { d: Ok }) {
  const b = d.fin.compras
  if (!b.ok) return <Falha />
  if (!b.dados.length) return <Vazio />
  return (
    <Tabela>
      <thead>
        <tr className="border-b border-[#1e3a5f]">
          <th className={th}>Solicitação</th>
          <th className={th}>Fornecedor</th>
          <th className={th + ' text-right'}>Valor</th>
          <th className={th}>Entrega</th>
          <th className={th}>NF</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {b.dados.map((c) => (
          <tr key={c.chave} className="border-b border-[#1e3a5f]">
            <td className={td}>
              <span className="block font-semibold">{c.solicitacaoNumero !== null ? `nº ${c.solicitacaoNumero}` : 'Solicitação'}</span>
              <span className="block text-xs text-[#94a3b8]">{c.descricao}</span>
              {c.link ? (
                <a href={c.link} className="inline-flex min-h-11 items-center text-xs font-medium text-[#f05a28] underline">
                  abrir no Compras ↗
                </a>
              ) : null}
            </td>
            <td className={td}>{c.fornecedor ?? '—'}</td>
            <td className={num}>
              {c.valorCentavos === null ? '—' : brl(c.valorCentavos)}
              {c.valorCentavos !== null && c.valorEstimado ? <span className="block text-[11px] text-[#94a3b8]">estimado</span> : null}
            </td>
            <td className={td}>{c.entrega ?? '—'}</td>
            <td className={td}>{c.nf ?? '—'}</td>
            <td className={td}>{c.status}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )
}

function Fornecedores({ d }: { d: Ok }) {
  const b = d.fin.fornecedores
  if (!b.ok) return <Falha />
  if (!b.dados.length) return <Vazio />
  return (
    <div className="flex flex-col gap-3">
      {b.dados.map((k) => (
        <article key={k.id} className="rounded-lg border border-[#1e3a5f] p-3">
          <h4 className="text-sm font-semibold text-[#e8eef7]">
            {k.fornecedor ?? 'Fornecedor'} · contrato {k.numero ?? '—'}
          </h4>
          {k.escopo ? <p className="text-xs text-[#94a3b8]">{k.escopo}</p> : null}
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-[#94a3b8]">Contrato</dt><dd className="font-mono">{brl(k.valorCentavos)}</dd></div>
            <div><dt className="text-[#94a3b8]">Medido</dt><dd className="font-mono">{brl(k.medidoCentavos)}</dd></div>
            <div><dt className="text-[#94a3b8]">Saldo</dt><dd className="font-mono font-semibold">{brl(k.saldoCentavos)}</dd></div>
          </dl>
          {k.medicoes.length ? (
            <ul className="mt-2 text-xs text-[#94a3b8]">
              {k.medicoes.map((m) => (
                <li key={m.id}>
                  {m.numero ?? 'Medição'} · {m.status} · <span className="font-mono">{brl(m.valorCentavos)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[#94a3b8]">Sem medições.</p>
          )}
        </article>
      ))}
    </div>
  )
}

function Pagamentos({ d }: { d: Ok }) {
  const q = d.fin.pendencias.caixinhaSemObra
  return (
    <div className="flex flex-col gap-2">
      <TabelaOrigens d={d} ids={['pagamentos', 'caixinha']} />
      {q === null ? (
        <p className="text-xs text-[#94a3b8]">Não deu para ler as despesas sem obra.</p>
      ) : q > 0 ? (
        <p className="text-xs text-[#fbbf24]">{q === 1 ? '1 despesa sem obra no CC' : `${q} despesas sem obra no CC`}</p>
      ) : null}
    </div>
  )
}

function Acoes({ obraId, pedidoId, hoje }: { obraId: string; pedidoId: string; hoje: string }) {
  const router = useRouter()
  const [ate, setAte] = useState('')
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function rodar(f: () => ReturnType<typeof marcarDevolvidaSpotAction>) {
    setIndo(true)
    setErro(null)
    const r = await f()
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={indo} className={botao} onClick={() => rodar(() => marcarDevolvidaSpotAction(obraId, pedidoId, hoje))}>
          Devolvida
        </button>
        <input
          type="date"
          aria-label="Renovar até"
          value={ate}
          min={hoje}
          onChange={(e) => setAte(e.target.value)}
          className="min-h-11 rounded-lg border border-[#1e3a5f] bg-[#0a1628] px-2 text-sm text-[#e8eef7]"
        />
        <button type="button" disabled={indo || !ate} className={botao} onClick={() => rodar(() => renovarLocacaoSpotAction(obraId, pedidoId, ate))}>
          Renovar até…
        </button>
      </div>
      {erro ? <p role="alert" className="text-xs text-[#f87171]">{erro}</p> : null}
    </div>
  )
}

function Locacoes({ d, obraId, hoje }: { d: Ok; obraId: string; hoje: string }) {
  if (!d.locacoes.length) return <Vazio />
  return (
    <div className="flex flex-col gap-3">
      {d.locacoes.map((l) => {
        // Feriados não vêm no bloco: o aviso conta só seg–sex (pode atrasar 1 dia o "próxima").
        const aviso = avisoLocacao(l, hoje, new Set())
        return (
          <article key={l.pedidoId} className="rounded-lg border border-[#1e3a5f] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-[#e8eef7]">{l.item}</h4>
              <span className="text-xs text-[#94a3b8]">
                {l.estado === 'devolvida' ? 'devolvida' : l.estado === 'renovada' ? 'renovada · em uso' : 'em uso'}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              {l.fornecedor ?? '—'} · {l.semPeriodo ? 'sem período' : `${data(l.inicio)} a ${data(l.fim)}`}
              {l.totalCentavos !== null ? ` · ${brl(l.totalCentavos)}` : ''}
            </p>
            {aviso ? (
              <p className={`mt-1 text-xs font-semibold ${aviso.tipo === 'proxima' ? 'text-[#fbbf24]' : 'text-[#f87171]'}`}>{textoAviso(aviso)}</p>
            ) : null}
            {l.estado !== 'devolvida' ? (
              <div className="mt-2">
                <Acoes obraId={obraId} pedidoId={l.pedidoId} hoje={hoje} />
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function Faturamento({ d }: { d: Ok }) {
  const b = d.fin.faturamento
  if (!b.ok) return <Falha />
  if (!b.dados.length && !d.externas.length) return <Vazio />
  return (
    <Tabela>
      <thead>
        <tr className="border-b border-[#1e3a5f]">
          <th className={th}>NF</th>
          <th className={th}>Emitida</th>
          <th className={th}>Situação</th>
          <th className={th + ' text-right'}>Valor</th>
        </tr>
      </thead>
      <tbody>
        {b.dados.map((n) => (
          <tr key={n.chave} className="border-b border-[#1e3a5f]">
            <td className={td}>{n.numero ? `NFS-e ${n.numero}` : 'sem número'}</td>
            <td className={td}>{data(n.emitidaEm)}</td>
            <td className={td}>
              {n.situacao}
              {!n.contaNaReceita ? <span className="block text-[11px] text-[#94a3b8]">não conta na receita</span> : null}
            </td>
            <td className={num}>{n.parcelaCentavos === null ? '—' : brl(n.parcelaCentavos)}</td>
          </tr>
        ))}
        {d.externas.map((n) => (
          <tr key={`ext-${n.nfse}`} className="border-b border-[#1e3a5f]">
            <td className={td}>NFS-e {n.nfse}</td>
            <td className={td}>{data(n.emitidaEm)}</td>
            <td className={td}>Emitida fora do sistema</td>
            <td className={num}>{brl(n.valorCentavos)}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )
}

export default function BlocoFinanceiroSpot({ obraId, dados, hoje }: { obraId: string; dados: FinanceiroSpot; hoje: string }) {
  const [aba, setAba] = useState<Aba>('Resumo')
  if (!dados.ok) {
    if (dados.motivo === 'sem-permissao') return null
    return (
      <section aria-label="Financeiro da OS" className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-4">
        <h2 className="text-sm font-semibold text-[#e8eef7]">Financeiro da OS</h2>
        <p role="alert" className="mt-2 text-sm text-[#f87171]">Não foi possível ler o financeiro agora.</p>
      </section>
    )
  }
  const r = dados.resumo
  return (
    <section aria-label="Financeiro da OS" className="flex flex-col gap-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#e8eef7]">Financeiro da OS</h2>
        <span className="text-xs text-[#94a3b8]">Dados até {diaBr(dados.lidoEm)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Total rotulo="Valor da OS" valor={r.valorCentavos === null ? '—' : brl(r.valorCentavos)} />
        <Total
          rotulo="Faturado"
          valor={brl(r.faturadoCentavos)}
          sub={[
            r.faturadoPct === null ? null : `${r.faturadoPct.toLocaleString('pt-BR')}%`,
            `${r.notas} ${r.notas === 1 ? 'nota' : 'notas'}`,
            r.faltaCentavos === null ? null : `falta ${brl(r.faltaCentavos)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Total rotulo="Custo comprometido" valor={brl(r.custo.comprometido)} sub={`realizado ${brl(r.custo.realizado)} · pago ${brl(r.custo.pago)}`} />
        <Total rotulo="Margem prevista" valor={pctTexto(r.margemPrevistaPct)} sub={r.margemPrevistaCentavos === null ? undefined : brl(r.margemPrevistaCentavos)} />
      </div>

      {r.foraDoSistema ? <p role="status" className="text-xs text-[#fbbf24]">Nota fora do sistema: faturado considerado pelo valor da OS.</p> : null}
      {r.acimaDoValorCentavos ? <p role="status" className="text-xs text-[#fbbf24]">Faturado acima do valor da OS em {brl(r.acimaDoValorCentavos)}</p> : null}

      <div role="tablist" aria-label="Seções do financeiro" className="flex flex-wrap gap-1.5">
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`min-h-11 rounded-lg border px-3 text-sm ${aba === a ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:text-[#e8eef7]'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {aba === 'Resumo' ? <Resumo d={dados} /> : null}
        {aba === 'Compras' ? <Compras d={dados} /> : null}
        {aba === 'Fornecedores' ? <Fornecedores d={dados} /> : null}
        {aba === 'Pagamentos e caixinha' ? <Pagamentos d={dados} /> : null}
        {aba === 'Locações' ? <Locacoes d={dados} obraId={obraId} hoje={hoje} /> : null}
        {aba === 'Faturamento' ? <Faturamento d={dados} /> : null}
      </div>
    </section>
  )
}
