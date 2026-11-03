'use client'

/**
 * Tela "Mapa da obra" (Leva 6, mockup aprovado): troca de modo (planta, croqui,
 * ambientes) só para ver — o modo salvo é o padrão —, cor por faixa de avanço,
 * pontos numerados, ▲ de impedimento aberto e o painel do ambiente escolhido.
 * No celular o desenho vira a lista de ambientes (spec §2.9).
 */

import { useState } from 'react'
import Link from 'next/link'
import type { ModoMapa } from '../../_lib/mapa-leitura'
import DesenhoMapa, { CORES_FAIXA, LegendaMapa, pctTexto } from './_desenho'
import type { AmbienteTela, MapaTela } from './_tipos'

const ROTULO_MODO: Record<ModoMapa, string> = { planta: 'Planta', croqui: 'Croqui', ambientes: 'Ambientes' }
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function detalhe(a: AmbienteTela): string {
  return [pctTexto(a.pct), a.areaM2 !== null ? `${a.areaM2.toLocaleString('pt-BR')} m²` : null].filter(Boolean).join(' · ')
}

function CartaoAmbiente({ a, sel, onClick }: { a: AmbienteTela; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={sel}
      className={`flex min-h-11 flex-col gap-1 rounded-xl border bg-(--obra-card) p-3 text-left ${
        sel ? 'border-(--obra-orange) shadow-[0_0_0_2px_#f85e0b33]' : 'border-(--obra-border)'
      }`}
    >
      <span className="font-semibold text-(--obra-ink)">{a.nome}</span>
      <span className="obra-num text-xs text-(--obra-muted-texto)">
        {pctTexto(a.pct)} · {a.atividades.length} atividade(s)
      </span>
      <span className="mt-1 block h-2 overflow-hidden rounded bg-(--obra-trilho)">
        <i className="block h-full" style={{ width: `${Math.round((a.pct ?? 0) * 100)}%`, background: CORES_FAIXA[4] }} />
      </span>
      {a.impedimentos.length ? (
        <span className="mt-1 w-fit rounded-full bg-[#fdecea] px-2 text-xs font-semibold text-(--obra-vermelho-texto)">
          ▲ {a.impedimentos.length} impedimento(s)
        </span>
      ) : null}
    </button>
  )
}

function Pilula({ a }: { a: AmbienteTela['atividades'][number] }) {
  const tom = a.concluida
    ? 'bg-[#e7f5ec] text-(--obra-verde-texto)'
    : a.atrasada
      ? 'bg-[#fff4e0] text-(--obra-yellow-texto)'
      : 'bg-[#eef1f4] text-(--obra-muted-texto)'
  return (
    <span className={`obra-num shrink-0 rounded-full px-2 text-xs font-semibold ${tom}`}>
      {Math.round(a.pct * 100)}%{a.atrasada && !a.concluida ? ' · atrasada' : ''}
    </span>
  )
}

export default function TelaMapa({
  obraId,
  mapa,
  podeMontar,
}: {
  obraId: string
  mapa: MapaTela
  podeMontar: boolean
}) {
  const modos: ModoMapa[] = [...(mapa.plantaUrl ? (['planta'] as const) : []), 'croqui', 'ambientes']
  const [modo, setModo] = useState<ModoMapa>(modos.includes(mapa.modo) ? mapa.modo : 'ambientes')
  const [selId, setSelId] = useState<string | null>(mapa.ambientes[0]?.id ?? null)
  const sel = mapa.ambientes.find((a) => a.id === selId) ?? null
  const pontosSel = sel ? mapa.pontos.filter((p) => p.ambienteId === sel.id) : []
  const semDesenho = mapa.ambientes.filter((a) => a.x === null).length
  const base = `/obras/obras/${obraId}/mapa`

  const cartoes = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {mapa.ambientes.map((a) => (
        <CartaoAmbiente key={a.id} a={a} sel={a.id === selId} onClick={() => setSelId(a.id)} />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">Mapa da obra</h2>
          <p className="text-sm text-(--obra-muted-texto)">Cor = avanço físico das atividades ligadas a cada ambiente</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Modo" className="hidden flex-wrap gap-1 md:flex">
            {modos.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`min-h-11 rounded-lg border px-3 text-sm ${
                  modo === m ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'
                }`}
              >
                {ROTULO_MODO[m]}
              </button>
            ))}
          </div>
          {podeMontar ? (
            <Link
              href={`${base}/montar`}
              className="flex min-h-11 items-center rounded-lg border border-(--obra-orange-texto) px-3 text-sm font-semibold text-(--obra-orange-texto)"
            >
              Montar o mapa
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
          {modo === 'ambientes' ? (
            cartoes
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-(--obra-border) md:block">
                <DesenhoMapa
                  modo={modo}
                  plantaUrl={mapa.plantaUrl}
                  plantaLargura={mapa.plantaLargura}
                  plantaAltura={mapa.plantaAltura}
                  ambientes={mapa.ambientes.map((a) => ({ ...a, detalhe: detalhe(a), impedimento: a.impedimentos.length > 0 }))}
                  pontos={mapa.pontos}
                  selecionado={selId}
                  onSelecionar={setSelId}
                />
              </div>
              <div className="md:hidden">{cartoes}</div>
              {semDesenho ? (
                <p className="mt-2 hidden text-xs text-(--obra-muted-texto) md:block">
                  {semDesenho} ambiente(s) sem desenho: aparecem só no modo Ambientes.
                </p>
              ) : null}
            </>
          )}
          <LegendaMapa />
        </section>

        <aside aria-label="Ambiente escolhido" className="min-w-0 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
          {sel ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-bold text-(--obra-ink)">{sel.nome}</h3>
                <p className="obra-num text-sm text-(--obra-muted-texto)">
                  {[
                    sel.areaM2 !== null ? `${sel.areaM2.toLocaleString('pt-BR')} m²` : null,
                    `avanço ${pctTexto(sel.pct)}`,
                    sel.previsto !== null ? `previsto ${pctTexto(sel.previsto)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-(--obra-ink)">Atividades ligadas</h4>
                {sel.atividades.length ? (
                  <ul className="flex flex-col gap-2">
                    {sel.atividades.map((a) => (
                      <li key={a.numero} className="flex items-center justify-between gap-2 rounded-lg border border-(--obra-border) px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="obra-num">{a.numero}</span> {a.descricao}
                        </span>
                        <Pilula a={a} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--obra-muted-texto)">Nenhuma atividade ligada — sem avanço (—).</p>
                )}
              </div>

              {sel.impedimentos.length ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-(--obra-vermelho-texto)">▲ Impedimentos abertos</h4>
                  <ul className="flex flex-col gap-1 text-sm">
                    {sel.impedimentos.map((i) => (
                      <li key={i.id}>{i.descricao}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-(--obra-ink)">Fotos recentes</h4>
                {sel.fotos.length ? (
                  <ul className="grid grid-cols-3 gap-2">
                    {sel.fotos.map((f) => (
                      <li key={f.id} className="relative overflow-hidden rounded-lg border border-(--obra-border) bg-(--obra-trilho)">
                        {f.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.url} alt={`Foto de ${dataCurta(f.data)}`} className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <div className="aspect-[4/3]" />
                        )}
                        <span className="obra-num absolute bottom-1 left-1 rounded bg-[#00345ecc] px-1.5 text-[11px] text-white">
                          {dataCurta(f.data)}
                          {f.pontoNumero !== null ? ` · P${f.pontoNumero}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--obra-muted-texto)">Nenhuma foto ligada a este ambiente ainda.</p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-(--obra-ink)">Pontos de foto</h4>
                {pontosSel.length ? (
                  <ul className="flex flex-col gap-2">
                    {pontosSel.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`${base}/ponto/${p.id}`}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-(--obra-border) px-3 text-sm text-(--obra-ink) hover:border-(--obra-orange-texto)"
                        >
                          <span>
                            <span className="obra-num font-semibold">Ponto {p.numero}</span> · {p.nome}
                          </span>
                          <span className="text-xs text-(--obra-orange-texto)">Ver linha do tempo das fotos</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--obra-muted-texto)">Sem ponto de foto neste ambiente.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-(--obra-muted-texto)">Escolha um ambiente no mapa.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
