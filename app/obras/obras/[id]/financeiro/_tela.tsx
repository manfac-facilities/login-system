import type { ReactNode } from 'react'
import { brl, type Bloco, type Financeiro, type ObraFin } from '../../_lib/financeiro-tela'
import { diaBr } from '../../_lib/restricao-pedido'
import Resumo from './_resumo'

/**
 * Aba Financeiro (render puro). R$ só aqui (`brl`). Cada bloco degrada sozinho:
 * dado inconsistente ou leitura que falhou não derruba os outros.
 * Links do Compras são <a> comuns — o Compras é outra app (nunca next/link).
 */

const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-(--obra-muted-texto)'
const td = 'px-3 py-2 align-top text-[14px] text-(--obra-text)'
const num = td + ' obra-num text-right whitespace-nowrap'

function Secao({ titulo, fonte, children }: { titulo: string; fonte: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-(--obra-ink)">{titulo}</h2>
        <span className="text-[12px] text-(--obra-muted-texto)">Fonte: {fonte}</span>
      </div>
      {children}
    </section>
  )
}

function Falha({ b }: { b: Bloco<unknown> }) {
  if (b.ok) return null
  return (
    <p role="alert" className="rounded-lg border border-(--obra-vermelho) bg-white px-3 py-2 text-sm text-(--obra-vermelho-texto)">
      {b.motivo === 'leitura'
        ? 'Não deu para ler estes dados agora. Recarregue em instantes.'
        : 'Dados inconsistentes na origem — este bloco não pôde ser montado. Avise o Financeiro.'}
    </p>
  )
}

const Vazio = () => <p className="text-sm text-(--obra-muted-texto)">Sem lançamentos.</p>
const data = (v: string | null) => (v ? diaBr(v) : '—')
const Tabela = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] border-collapse">{children}</table>
  </div>
)

export default function TelaFinanceiro({ fin, obras, obraId, lidoEm }: { fin: Financeiro; obras: ObraFin[]; obraId: string; lidoEm: string }) {
  const nomeOS = (os: string) => (os === '—' ? 'OS não informada' : `OS ${os}`)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="obra-num text-[13px] text-(--obra-muted-texto)">
          Dados até {diaBr(lidoEm)} · lidos agora do Compras, da Gestão de Fornecedores e do Financeiro
          {obras.length > 1 ? ` · mãe + ${obras.length - 1} ${obras.length === 2 ? 'aditivo' : 'aditivos'}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
        <a
          href={`/financeiro/solicitacoes/nova?obra=${obraId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-white px-3 text-sm font-medium text-(--obra-ink) hover:border-(--obra-orange-texto)"
        >
          Pedir pagamento
        </a>
        <a
          href={`/fornecedores/medicoes/nova?obra=${obraId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-white px-3 text-sm font-medium text-(--obra-ink) hover:border-(--obra-orange-texto)"
        >
          Pedir medição
        </a>
        <a
          href={`/compras/solicitacoes/nova?obra=${obraId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-white px-3 text-sm font-medium text-(--obra-ink) hover:border-(--obra-orange-texto)"
        >
          Pedir material
        </a>
        </div>
      </div>

      {fin.semLancamentos ? (
        <p className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-8 text-center text-[15px] text-(--obra-muted-texto)">
          Sem lançamentos financeiros nesta obra ainda.
        </p>
      ) : null}

      <Secao titulo="Resumo" fonte="Compras, Fornecedores, Financeiro (pagamentos, rateio, caixinha) e Faturamento">
        <Falha b={fin.resumo} />
        {fin.resumo.ok ? <Resumo d={fin.resumo.dados} pend={fin.pendencias} obraId={obraId} /> : null}
      </Secao>

      <Secao titulo="Compras" fonte="Compras">
        <Falha b={fin.compras} />
        {fin.compras.ok && fin.compras.dados.length === 0 ? <Vazio /> : null}
        {fin.compras.ok && fin.compras.dados.length ? (
          <Tabela>
            <thead>
              <tr className="border-b border-(--obra-border)">
                <th className={th}>Solicitação</th>
                <th className={th}>Fornecedor</th>
                <th className={th + ' text-right'}>Valor</th>
                <th className={th}>Previsão</th>
                <th className={th}>Entrega</th>
                <th className={th}>NF</th>
                <th className={th}>Pago</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {fin.compras.dados.map((c) => (
                <tr key={c.chave} className="border-b border-(--obra-border)">
                  <td className={td}>
                    <span className="block font-semibold text-(--obra-ink)">
                      {c.solicitacaoNumero !== null ? `nº ${c.solicitacaoNumero}` : 'Solicitação'}
                      {obras.length > 1 ? ` · ${nomeOS(c.os)}` : ''}
                    </span>
                    <span className="block text-[13px]">{c.descricao}</span>
                    {c.link ? (
                      <a href={c.link} className="inline-flex min-h-11 items-center text-[13px] font-medium text-(--obra-orange-texto) underline">
                        abrir no Compras
                      </a>
                    ) : null}
                  </td>
                  <td className={td}>{c.fornecedor ?? '—'}</td>
                  <td className={num}>
                    {c.valorCentavos === null ? '—' : brl(c.valorCentavos)}
                    {c.valorCentavos !== null && c.valorEstimado ? <span className="block text-[11px] text-(--obra-muted-texto)">estimado</span> : null}
                  </td>
                  <td className={td + ' obra-num'}>{data(c.previsao)}</td>
                  <td className={td}>{c.entrega ? `${c.entrega}${c.entregaEm ? ` · ${diaBr(c.entregaEm)}` : ''}` : '—'}</td>
                  <td className={td}>{c.nf ?? '—'}</td>
                  <td className={td + ' obra-num'}>{data(c.pagoEm)}</td>
                  <td className={td}>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        ) : null}
      </Secao>

      <Secao titulo="Fornecedores" fonte="Gestão de Fornecedores">
        <Falha b={fin.fornecedores} />
        {fin.fornecedores.ok && fin.fornecedores.dados.length === 0 ? <Vazio /> : null}
        {fin.fornecedores.ok
          ? fin.fornecedores.dados.map((k) => (
              <article key={k.id} className="flex flex-col gap-2 rounded-lg border border-(--obra-border) p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-(--obra-ink)">
                    {k.fornecedor ?? 'Fornecedor'} · contrato {k.numero ?? '—'}
                    {obras.length > 1 ? ` · ${nomeOS(k.os)}` : ''}
                  </h3>
                  <span className="text-[13px] text-(--obra-muted-texto)">{k.status ?? ''}</span>
                </div>
                {k.escopo ? <p className="text-[13px] text-(--obra-text)">{k.escopo}</p> : null}
                <dl className="grid grid-cols-3 gap-2 text-[13px]">
                  <div><dt className="text-(--obra-muted-texto)">Contrato</dt><dd className="obra-num">{brl(k.valorCentavos)}</dd></div>
                  <div><dt className="text-(--obra-muted-texto)">Medido</dt><dd className="obra-num">{brl(k.medidoCentavos)}</dd></div>
                  <div><dt className="text-(--obra-muted-texto)">Saldo</dt><dd className="obra-num font-semibold">{brl(k.saldoCentavos)}</dd></div>
                </dl>
                {k.medicoes.length ? (
                  <Tabela>
                    <thead>
                      <tr className="border-b border-(--obra-border)">
                        <th className={th}>Medição</th>
                        <th className={th}>Competência</th>
                        <th className={th}>Situação</th>
                        <th className={th + ' text-right'}>Valor</th>
                        <th className={th}>Paga em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.medicoes.map((m) => (
                        <tr key={m.id} className="border-b border-(--obra-border)">
                          <td className={td}>{[m.numero, m.item === 'mo' ? 'mão de obra' : m.item === 'mat' ? 'material' : m.item].filter(Boolean).join(' · ') || '—'}</td>
                          <td className={td + ' obra-num'}>{data(m.competencia)}</td>
                          <td className={td}>{m.status}</td>
                          <td className={num}>{brl(m.valorCentavos)}</td>
                          <td className={td + ' obra-num'}>{data(m.pagoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                ) : (
                  <p className="text-[13px] text-(--obra-muted-texto)">Sem medições.</p>
                )}
              </article>
            ))
          : null}
      </Secao>

      <Secao titulo="Faturamento" fonte="Financeiro (NF ao cliente)">
        <Falha b={fin.faturamento} />
        {fin.faturamento.ok && fin.faturamento.dados.length === 0 ? <Vazio /> : null}
        {fin.faturamento.ok && fin.faturamento.dados.length ? (
          <Tabela>
            <thead>
              <tr className="border-b border-(--obra-border)">
                <th className={th}>NF</th>
                <th className={th}>Tomador</th>
                <th className={th}>Emitida</th>
                <th className={th}>Situação</th>
                <th className={th + ' text-right'}>Parcela desta obra</th>
                <th className={th + ' text-right'}>Total da NF</th>
              </tr>
            </thead>
            <tbody>
              {fin.faturamento.dados.map((n) => (
                <tr key={n.chave} className="border-b border-(--obra-border)">
                  <td className={td}>{n.numero ?? 'sem número'}{obras.length > 1 ? ` · ${nomeOS(n.os)}` : ''}</td>
                  <td className={td}>{n.tomador ?? '—'}</td>
                  <td className={td + ' obra-num'}>{data(n.emitidaEm)}</td>
                  <td className={td}>
                    {n.situacao}
                    {n.parcelaCentavos === null ? <span className="block text-[11px] text-(--obra-muted-texto)">parcela não informada no Financeiro</span> : !n.contaNaReceita ? <span className="block text-[11px] text-(--obra-muted-texto)">não conta na receita</span> : null}
                  </td>
                  <td className={num}>{n.parcelaCentavos === null ? '—' : brl(n.parcelaCentavos)}</td>
                  <td className={num}>{n.totalCentavos === null ? '—' : brl(n.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        ) : null}
      </Secao>
    </div>
  )
}
