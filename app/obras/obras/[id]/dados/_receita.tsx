'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { textoDeCentavos } from '../../_lib/medicao'
import { salvarValorReceitaAction } from './_actions'
import type { OsReceita } from './_tipos'

const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-(--obra-muted-texto)'
const td = 'px-3 py-2 align-middle text-[14px] text-(--obra-text)'
const brl = (c: number) => `R$ ${textoDeCentavos(c)}`

function Linha({ obraId, o, admin }: { obraId: string; o: OsReceita; admin: boolean }) {
  const router = useRouter()
  const inicial = o.receitaCentavos === null ? '' : textoDeCentavos(o.receitaCentavos)
  const [texto, setTexto] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const mudou = texto.trim() !== inicial

  async function salvar() {
    setIndo(true)
    setErro(null)
    const r = await salvarValorReceitaAction(obraId, o.id, texto)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }

  return (
    <tr className="border-b border-(--obra-border)">
      <td className={td + ' obra-num whitespace-nowrap'}>{o.os ?? '—'}</td>
      <td className={td}>{o.descricao}</td>
      <td className={td + ' text-right'}>
        {admin && !o.cancelada ? (
          <span className="inline-flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-2">
              <input
                aria-label={`Valor receita da OS ${o.os ?? ''}`.trim()}
                inputMode="decimal"
                placeholder="0,00"
                className="obra-num min-h-11 w-40 rounded-lg border border-(--obra-border) bg-white px-3 text-right text-[14px] text-(--obra-text)"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <button
                type="button"
                disabled={!mudou || indo}
                onClick={salvar}
                className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45"
              >
                {indo ? 'salvando…' : 'Salvar'}
              </button>
            </span>
            {erro ? <span role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</span> : null}
          </span>
        ) : (
          <span className="obra-num">{o.receitaCentavos === null ? 'não informado' : brl(o.receitaCentavos)}</span>
        )}
      </td>
      <td className={td}>
        <span className="rounded-full bg-(--obra-surface) px-2 py-0.5 text-[12px] font-semibold text-(--obra-muted-texto)">
          {o.cancelada ? 'OS cancelada · fora do total' : o.receitaCentavos === null ? 'sem valor' : 'digitado'}
        </span>
      </td>
    </tr>
  )
}

export default function ValorReceita({ obraId, oss, admin }: { obraId: string; oss: OsReceita[]; admin: boolean }) {
  // OS cancelada não conta no total (nem pede valor).
  const valendo = oss.filter((o) => !o.cancelada)
  const total = valendo.reduce((s, o) => s + (o.receitaCentavos ?? 0), 0)
  const faltando = valendo.some((o) => o.receitaCentavos === null)
  return (
    <section aria-labelledby="receita-titulo" className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
      <h2 id="receita-titulo" className="text-lg font-bold text-(--obra-ink)">Valor receita por OS</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-(--obra-border)">
              <th className={th}>OS</th>
              <th className={th}>Descrição</th>
              <th className={th + ' text-right'}>Valor receita</th>
              <th className={th}>Origem</th>
            </tr>
          </thead>
          <tbody>
            {oss.map((o) => (
              <Linha key={`${o.id}:${o.receitaCentavos}`} obraId={obraId} o={o} admin={admin} />
            ))}
            {valendo.length > 1 || valendo.length !== oss.length ? (
              <tr className="font-semibold">
                <td className={td} colSpan={2}>Total da obra</td>
                <td className={td + ' obra-num text-right'}>{brl(total)}</td>
                <td className={td} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-(--obra-muted-texto)">
        {faltando
          ? 'Sem valor digitado, a aba Financeiro mostra "informe o valor receita em Dados da obra" no lugar da receita esperada e da margem.'
          : 'A mãe soma os aditivos no total da obra. As medições ao cliente calculam o % sobre o valor receita de cada OS.'}
      </p>
    </section>
  )
}
