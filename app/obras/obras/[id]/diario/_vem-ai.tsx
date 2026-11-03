'use client'

import { useState } from 'react'
import { linkPedirMaterial, type ItemVemAi } from '../../_lib/material'
import type { Restricao } from '../../_lib/last-planner'
import { responderNaoPrecisaAction, responderPrecisaAction } from '../lookahead/_actions'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const btn =
  'min-h-11 flex-1 rounded-lg border border-(--obra-border) bg-white px-3 text-sm font-medium text-(--obra-text) hover:border-(--obra-orange-texto) disabled:opacity-45'
const btnPrim = 'min-h-11 flex-1 rounded-lg bg-(--obra-orange-texto) px-3 text-sm font-semibold text-white disabled:opacity-45'
const selo = 'flex-none rounded-full border px-2 py-0.5 text-xs font-semibold'

/** Selo do item: vence hoje / venceu em vermelho; senão "Sem resposta". */
function Selo({ pedirAte, hoje }: { pedirAte: string; hoje: string }) {
  if (pedirAte > hoje) return <span className={`${selo} border-(--obra-border) text-(--obra-muted-texto)`}>Sem resposta</span>
  return (
    <span className={`${selo} border-(--obra-vermelho-texto) text-(--obra-vermelho-texto)`}>
      {pedirAte === hoje ? 'Pedir hoje' : `Vencido em ${dm(pedirAte)}`}
    </span>
  )
}

function Cartao({
  obraId,
  item,
  hoje,
  onNaoPrecisa,
}: {
  obraId: string
  item: ItemVemAi
  hoje: string
  onNaoPrecisa: () => void
}) {
  const [modo, setModo] = useState<'perguntar' | 'material'>('perguntar')
  const [material, setMaterial] = useState('')
  const [criada, setCriada] = useState<{ id: string; descricao: string } | null>(null)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function rodar(f: () => Promise<{ ok: true; id?: string } | { ok: false; erro: string }>, depois: (id?: string) => void) {
    setIndo(true)
    setErro(null)
    try {
      const r = await f()
      if (!r.ok) return setErro(r.erro)
      depois(r.id)
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  function salvar() {
    const texto = material.trim()
    if (!texto) return setErro('Diga qual é o material.')
    void rodar(
      () => responderPrecisaAction(obraId, item.numero, texto),
      (id) => (id ? setCriada({ id, descricao: texto }) : setErro('A restrição foi criada; abra o Lookahead para pedir no Compras.')),
    )
  }

  // Só `id` e `descricao` entram no link; o resto é o formato de `Restricao`.
  const restricao = (c: { id: string; descricao: string }): Restricao => ({
    id: c.id, obraId, atividadeNumero: item.numero, tipo: 'material', descricao: c.descricao, responsavel: 'manfac',
    prazo: item.pedirAte, situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: '',
  })

  return (
    <li data-testid={`vem-ai-${item.numero}`} className="flex flex-col gap-2 rounded-lg border border-(--obra-border) bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold text-(--obra-ink)">
          <span className="obra-num mr-1 text-(--obra-muted-texto)">{item.numero}</span>
          {item.nome}
        </p>
        {criada ? null : <Selo pedirAte={item.pedirAte} hoje={hoje} />}
      </div>
      <p className="obra-num text-xs text-(--obra-muted-texto)">{`Começa ${dm(item.inicio)} · Pedir até ${dm(item.pedirAte)}`}</p>
      {criada ? (
        <>
          <p className="text-sm text-(--obra-verde-texto)">Restrição criada: {criada.descricao}</p>
          <a
            href={linkPedirMaterial({ obraId, restricao: restricao(criada), atividade: { numero: item.numero, nome: item.nome, inicio: item.inicio } })}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnPrim} inline-flex items-center justify-center`}
          >
            Pedir no Compras
          </a>
        </>
      ) : modo === 'material' ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
            Qual material?
            <textarea
              value={material}
              maxLength={500}
              rows={2}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Ex.: aço CA-50 10 mm, 480 kg"
              className="rounded-lg border border-(--obra-border) bg-(--obra-surface) px-3 py-2 text-base text-(--obra-text)"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={indo} onClick={() => (setModo('perguntar'), setErro(null))}>
              Cancelar
            </button>
            <button type="button" className={btnPrim} disabled={indo} onClick={salvar}>
              {indo ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            disabled={indo}
            onClick={() => void rodar(() => responderNaoPrecisaAction(obraId, item.numero), onNaoPrecisa)}
          >
            Não precisa
          </button>
          <button type="button" className={btn} disabled={indo} onClick={() => setModo('material')}>
            Precisa
          </button>
        </div>
      )}
      {erro ? (
        <p role="alert" className="text-xs text-(--obra-vermelho-texto)">
          {erro}
        </p>
      ) : null}
    </li>
  )
}

/**
 * Passo "Vem aí" do diário (material antecipado, spec §4.1/§5.1): atividades das próximas 4 semanas
 * ainda sem resposta sobre material. Opcional — não bloqueia o envio do diário.
 * `itens` null = as respostas não foram lidas: não pergunta (nada de pergunta repetida).
 */
export default function VemAi({
  obraId,
  hoje,
  diasCompras,
  itens,
}: {
  obraId: string
  hoje: string
  /** Folga do processo + entrega de material do Compras, em dias úteis. */
  diasCompras: number
  itens: ItemVemAi[] | null
}) {
  const [lista, setLista] = useState(itens ?? [])
  const [anotado, setAnotado] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-(--obra-ink)">Vem aí: precisa de material?</h3>
      {itens === null ? (
        <p className="text-sm text-(--obra-muted-texto)">Não deu para carregar as respostas agora.</p>
      ) : (
        <>
          <p className="text-sm text-(--obra-muted-texto)">
            Atividades que começam nas próximas 4 semanas. O Compras precisa de <span className="obra-num">{diasCompras}</span> dias
            úteis; o &quot;pedir até&quot; já desconta isso.
          </p>
          {anotado !== null ? (
            <p role="status" className="text-xs text-(--obra-verde-texto)">
              Anotado: atividade {anotado} não precisa de material.
            </p>
          ) : null}
          {lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-(--obra-border) px-3 py-4 text-center text-sm text-(--obra-muted-texto)">
              Tudo respondido nas próximas 4 semanas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((it) => (
                <Cartao
                  key={it.numero}
                  obraId={obraId}
                  item={it}
                  hoje={hoje}
                  onNaoPrecisa={() => {
                    setLista((l) => l.filter((x) => x.numero !== it.numero))
                    setAnotado(it.numero)
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
