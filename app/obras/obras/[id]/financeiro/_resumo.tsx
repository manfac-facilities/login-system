import type { ReactNode } from 'react'
import { brl, pctTexto, type Financeiro } from '../../_lib/financeiro-tela'
import type { Custo, OrigemCusto } from '../../_lib/financeiro-obra'

/**
 * Resumo do Financeiro da obra (Fases B/C, mockup "Financeiro"): KPIs, avanço × liberado ×
 * faturado, pendências, margem, Por OS e Custos por origem. Render puro; R$ só aqui (`brl`).
 * Sem valor receita: "Informe o valor receita em Dados da obra" no lugar da receita e da margem.
 * Nenhum número sem valor vira NaN: null → "—".
 */

type Dados = Extract<Financeiro['resumo'], { ok: true }>['dados']

const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-(--obra-muted-texto)'
const td = 'px-3 py-2 align-top text-[14px] text-(--obra-text)'
const num = td + ' obra-num text-right whitespace-nowrap'
const card = 'flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4'

const ouTraco = (c: number | null) => (c === null ? '—' : brl(c))
const pp = (x: number) => `${x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Tom = 'n' | 'ok' | 'warn' | 'bad'
const PILULA: Record<Tom, string> = {
  n: 'bg-(--obra-surface) text-(--obra-muted-texto)',
  ok: 'bg-(--obra-surface) text-(--obra-verde-texto)',
  warn: 'bg-(--obra-surface) text-(--obra-yellow-texto)',
  bad: 'bg-(--obra-surface) text-(--obra-vermelho-texto)',
}
function Pilula({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={`inline-block rounded-full border border-(--obra-border) px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${PILULA[tom]}`}>{children}</span>
}

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-(--obra-border) bg-(--obra-card) px-4 py-3">
      <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-(--obra-muted-texto)">{rotulo}</span>
      <span className="obra-num text-[20px] font-semibold text-(--obra-ink)" style={cor ? { color: cor } : undefined}>{valor}</span>
      {sub ? <span className="text-[12px] text-(--obra-muted-texto)">{sub}</span> : null}
    </div>
  )
}

function Barra({ rotulo, pct, cor }: { rotulo: string; pct: number | null; cor: string }) {
  const largura = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span>{rotulo}</span>
        <b className="obra-num">{pctTexto(pct)}</b>
      </div>
      <div className="relative h-3.5 overflow-hidden rounded-full bg-(--obra-trilho)" role="img" aria-label={`${rotulo}: ${pctTexto(pct)}`}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${largura}%`, backgroundColor: cor }} />
      </div>
    </div>
  )
}

function InformeReceita({ obraId }: { obraId: string }) {
  return (
    <a href={`/obras/obras/${obraId}/dados`} className="inline-flex min-h-11 items-center text-[14px] font-medium text-(--obra-orange-texto) underline">
      Informe o valor receita em Dados da obra
    </a>
  )
}

const ORIGENS: { id: OrigemCusto; rotulo: string; nota?: string }[] = [
  { id: 'compras', rotulo: 'Compras (pedidos)' },
  { id: 'fornecedores', rotulo: 'Fornecedores (medições)' },
  { id: 'pagamentos', rotulo: 'Pagamentos / rateio no Financeiro', nota: 'pagamentos lançados direto no Financeiro' },
  { id: 'caixinha', rotulo: 'Caixinha' },
  { id: 'locacoes', rotulo: 'Locações' },
]

const COR_MARGEM = (v: number | null) => (v === null ? undefined : v < 0 ? 'var(--obra-vermelho-texto)' : 'var(--obra-verde-texto)')

export default function Resumo({ d, pend, obraId }: { d: Dados; pend: Financeiro['pendencias']; obraId: string }) {
  const t = d.total
  const semReceita = t.receitaEsperada === null
  const nomeOS = (os: string) => (os === '—' ? 'OS não informada' : os)
  const papel = { mae: ' · mãe', aditivo: ' · aditivo', obra: '' }

  const chips: Record<OrigemCusto, ReactNode[]> = { compras: [], fornecedores: [], pagamentos: [], caixinha: [], locacoes: [] }
  if (pend.comprasSemEntrega > 0) chips.compras.push(<Pilula key="e" tom="n">{plural(pend.comprasSemEntrega, 'sem entrega', 'sem entrega')}</Pilula>)
  if (pend.medicoesFornecedorAtrasadas === null) chips.fornecedores.push(<Pilula key="x" tom="n">não deu para ler as medições em aprovação</Pilula>)
  else if (pend.medicoesFornecedorAtrasadas.quantidade > 0) {
    const m = pend.medicoesFornecedorAtrasadas
    chips.fornecedores.push(
      <Pilula key="a" tom="warn">
        {m.quantidade === 1 ? `1 medição há ${m.maisDias} dias em aprovação` : `${m.quantidade} medições há mais de 10 dias em aprovação`}
      </Pilula>,
    )
  }
  if (d.vinculosDeMedicaoFornecedor > 0) {
    chips.pagamentos.push(
      <Pilula key="m" tom="n">{plural(d.vinculosDeMedicaoFornecedor, 'pagamento de medição já em Fornecedores', 'pagamentos de medição já em Fornecedores')}</Pilula>,
    )
  }
  if (pend.caixinhaSemObra === null) chips.caixinha.push(<Pilula key="x" tom="n">não deu para ler as despesas sem obra</Pilula>)
  else if (pend.caixinhaSemObra > 0) chips.caixinha.push(<Pilula key="s" tom="bad">{plural(pend.caixinhaSemObra, 'despesa sem obra no CC', 'despesas sem obra no CC')}</Pilula>)
  if (pend.locacoes === null) chips.locacoes.push(<Pilula key="x" tom="n">não deu para ler as locações</Pilula>)
  else if (pend.locacoes.quantidade > 0) {
    chips.locacoes.push(
      <Pilula key="l" tom={pend.locacoes.urgente ? 'bad' : 'warn'}>
        {pend.locacoes.quantidade === 1 ? pend.locacoes.primeira : `${pend.locacoes.quantidade} vencendo · ${pend.locacoes.primeira}`}
      </Pilula>,
    )
  }

  const linhaOrigem = (o: (typeof ORIGENS)[number], c: Custo) => (
    <tr key={o.id} className="border-b border-(--obra-border)">
      <td className={td}>
        {o.rotulo}
        {o.nota ? <span className="block text-[12px] text-(--obra-muted-texto)">{o.nota}</span> : null}
      </td>
      <td className={num}>{brl(c.comprometido)}</td>
      <td className={num}>{brl(c.realizado)}</td>
      <td className={num}>{brl(c.pago)}</td>
      <td className={td}><span className="flex flex-wrap gap-1">{chips[o.id]}</span></td>
    </tr>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Receita esperada"
          valor={semReceita ? '—' : brl(t.receitaEsperada as number)}
          sub={semReceita ? <InformeReceita obraId={obraId} /> : `valor receita de ${plural(d.porOS.filter((l) => l.receitaEsperada !== null).length, 'OS', 'OS')}`}
        />
        <Kpi rotulo="Faturado" valor={brl(t.receitaRealizada)} sub={d.percentuais.faturado === null ? undefined : `${pctTexto(d.percentuais.faturado)} da receita`} />
        <Kpi rotulo="Custo comprometido" valor={brl(t.custoComprometido)} sub={`realizado ${brl(t.custoRealizado)} · pago ${brl(t.custoPago)}`} />
        <Kpi
          rotulo="Margem projetada"
          valor={semReceita ? '—' : pctTexto(t.margemProjetadaPct)}
          cor={COR_MARGEM(t.margemProjetada)}
          sub={semReceita ? <InformeReceita obraId={obraId} /> : t.margemProjetada === null ? 'sem avanço físico' : `${brl(t.margemProjetada)} · estimativa`}
        />
      </div>
      {!semReceita && d.osSemReceita > 0 ? (
        <p role="status" className="text-[13px] font-medium text-(--obra-orange-texto)">
          {plural(d.osSemReceita, 'OS sem valor receita', 'OS sem valor receita')} — a receita esperada está incompleta. <InformeReceita obraId={obraId} />
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="text-[15px] font-bold text-(--obra-ink)">Avanço × liberado × faturado</h3>
          <div className="flex flex-col gap-3">
            <Barra rotulo="Avanço físico" pct={d.percentuais.avanco} cor="var(--obra-ink)" />
            <Barra rotulo="Liberado pelo cliente" pct={d.percentuais.liberado} cor="var(--obra-orange)" />
            <Barra rotulo="Faturado" pct={d.percentuais.faturado} cor="var(--obra-muted)" />
          </div>
          {semReceita ? <p className="text-[13px] text-(--obra-muted-texto)">Liberado e faturado em % dependem do valor receita.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-(--obra-border) p-3">
              <span className="text-[12px] text-(--obra-muted-texto)">Liberado e ainda não faturado</span>
              <span className="obra-num text-[18px] font-semibold" style={{ color: d.pendencias.liberadoNaoFaturado > 0 ? 'var(--obra-vermelho-texto)' : undefined }}>
                {brl(d.pendencias.liberadoNaoFaturado)}
              </span>
              {d.pendencias.liberadoNaoFaturado > 0 ? <span><Pilula tom="bad">emitir nota</Pilula></span> : null}
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-(--obra-border) p-3">
              <span className="text-[12px] text-(--obra-muted-texto)">Avanço à frente do liberado</span>
              <span className="obra-num text-[18px] font-semibold" style={{ color: d.pendencias.avancoAFrente ? 'var(--obra-yellow-texto)' : undefined }}>
                {d.pendencias.avancoAFrente === null || d.pendencias.avancoAFrentePP === null
                  ? '—'
                  : `${pp(d.pendencias.avancoAFrentePP)} · ${brl(d.pendencias.avancoAFrente)}`}
              </span>
              {d.pendencias.avancoAFrente ? <span><Pilula tom="warn">negociar liberação</Pilula></span> : null}
              {d.pendencias.avancoAFrente === null ? (
                <span className="text-[12px] text-(--obra-muted-texto)">{semReceita ? 'precisa do valor receita' : 'sem avanço físico'}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={card}>
          <h3 className="text-[15px] font-bold text-(--obra-ink)">Margem</h3>
          {semReceita ? <InformeReceita obraId={obraId} /> : null}
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-(--obra-border)"><td className={td}>Receita esperada</td><td className={num}>{ouTraco(t.receitaEsperada)}</td></tr>
              <tr className="border-b border-(--obra-border)"><td className={td}>Custo comprometido até hoje</td><td className={num}>{brl(t.custoComprometido)}</td></tr>
              <tr className="border-b border-(--obra-border)">
                <td className={td}>
                  Custo projetado no fim
                  <span className="block text-[12px] text-(--obra-muted-texto)">
                    comprometido ÷ avanço físico{d.percentuais.avanco !== null && d.percentuais.avanco > 0 ? ` (${pctTexto(d.percentuais.avanco)})` : ' — sem avanço'}
                  </span>
                </td>
                <td className={num}>{ouTraco(t.custoProjetado)}</td>
              </tr>
              <tr className="border-b border-(--obra-border) font-semibold">
                <td className={td}>Margem projetada</td>
                <td className={num} style={{ color: COR_MARGEM(t.margemProjetada) }}>
                  {t.margemProjetada === null ? '—' : `${brl(t.margemProjetada)} · ${pctTexto(t.margemProjetadaPct)}`}
                </td>
              </tr>
              <tr>
                <td className={td}>Margem realizada (faturado − custo realizado)</td>
                <td className={num} style={{ color: COR_MARGEM(t.margemRealizada) }}>
                  {brl(t.margemRealizada)}{t.margemPct === null ? '' : ` · ${pctTexto(t.margemPct)}`}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-[12px] text-(--obra-muted-texto)">
            A projeção é uma régua simples até existir PEF por obra. Margem realizada negativa no meio da obra é normal enquanto o faturamento está atrás do gasto.
          </p>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-[15px] font-bold text-(--obra-ink)">Por OS</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-(--obra-border)">
                <th className={th}>OS</th>
                <th className={th + ' text-right'}>Receita esperada</th>
                <th className={th + ' text-right'}>Liberado</th>
                <th className={th + ' text-right'}>Faturado</th>
                <th className={th + ' text-right'}>Comprometido</th>
                <th className={th + ' text-right'}>Realizado</th>
                <th className={th + ' text-right'}>Pago</th>
                <th className={th + ' text-right'}>Margem projetada</th>
              </tr>
            </thead>
            <tbody>
              {[...d.porOS, ...(d.porOS.length > 1 ? [{ ...t, papel: 'total' as const }] : [])].map((l) => (
                <tr key={l.obraId ?? 'total'} className={'border-b border-(--obra-border) ' + (l.papel === 'total' ? 'font-semibold' : '')}>
                  <td className={td}>{l.papel === 'total' ? 'Total' : nomeOS(l.os) + papel[l.papel]}</td>
                  <td className={num}>
                    {l.cancelada ? <span className="text-[12px] text-(--obra-muted-texto)">OS cancelada</span> : ouTraco(l.receitaEsperada)}
                  </td>
                  <td className={num}>{brl(l.liberado)}</td>
                  <td className={num}>{brl(l.receitaRealizada)}</td>
                  <td className={num}>{brl(l.custoComprometido)}</td>
                  <td className={num}>{brl(l.custoRealizado)}</td>
                  <td className={num}>{brl(l.custoPago)}</td>
                  <td className={num}>
                    {pctTexto(l.margemProjetadaPct)}
                    {l.margemProjetadaPct === null && !l.cancelada ? (
                      <span className="block text-[11px] font-normal text-(--obra-muted-texto)">{l.receitaEsperada === null ? 'sem valor receita' : 'sem avanço'}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.porOS.length > 1 ? (
          <p className="text-[12px] text-(--obra-muted-texto)">O avanço físico é o do cronograma desta obra; o total usa esse avanço para projetar o custo.</p>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-[15px] font-bold text-(--obra-ink)">Custos por origem</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-(--obra-border)">
                <th className={th}>Origem</th>
                <th className={th + ' text-right'}>Comprometido</th>
                <th className={th + ' text-right'}>Realizado</th>
                <th className={th + ' text-right'}>Pago</th>
                <th className={th}>Pendências</th>
              </tr>
            </thead>
            <tbody>{ORIGENS.map((o) => linhaOrigem(o, d.origens[o.id]))}</tbody>
          </table>
        </div>
        <p className="text-[12px] text-(--obra-muted-texto)">
          Comprometido = pedido emitido, medição aprovada, pagamento pedido no Financeiro e despesa de caixinha não reprovada; realizado = NF, pagamento solicitado/lançado ou caixinha aprovada.
          Pagamento gerado por medição de fornecedor conta uma vez só (em Fornecedores). Despesas sem obra no CC: contagem da empresa toda.
        </p>
      </div>

      {d.notasSemParcela > 0 ? (
        <p role="status" className="text-[13px] font-medium text-(--obra-orange-texto)">
          {d.notasSemParcela} {d.notasSemParcela === 1 ? 'nota sem valor de parcela' : 'notas sem valor de parcela'} — receita pode estar incompleta
        </p>
      ) : null}
    </div>
  )
}
