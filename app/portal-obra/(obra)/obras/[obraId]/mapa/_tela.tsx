'use client'

/**
 * Aba Mapa do portal (Leva 6, mockup "No portal do cliente"): o mesmo desenho
 * da tela interna, no modo salvo da obra, colorido pelo avanço. Tocar num
 * ambiente mostra avanço, atividades (código e situação do cronograma do
 * portal) e as últimas fotos de diário já validado. No celular o desenho vira a
 * lista de ambientes. Só recebe dados já filtrados pelo lado cliente.
 */

import { useState } from 'react'
import DesenhoMapa, { CORES_FAIXA, LegendaMapa, pctTexto } from '@/app/obras/obras/[id]/mapa/_desenho'
import type { AmbienteCliente, MapaCliente } from '../../../_lib/mapa'
import { Bloco, Vazio } from '../../../_ui/blocos'

const TOM: Record<AmbienteCliente['atividades'][number]['tom'], string> = {
  ok: 'text-(--obra-verde-texto)',
  atencao: 'text-(--obra-yellow-texto)',
  atraso: 'text-[#9a2a00] font-semibold',
  neutro: 'text-(--obra-text)',
}
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const area = (a: AmbienteCliente) => (a.areaM2 !== null ? `${a.areaM2.toLocaleString('pt-BR')} m²` : null)

function Cartao({ a, sel, onClick }: { a: AmbienteCliente; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={sel}
      className={`flex min-h-11 flex-col gap-1 rounded-xl border bg-(--obra-card) p-3 text-left ${
        sel ? 'border-(--obra-orange) shadow-[0_0_0_2px_#f85e0b33]' : 'border-(--obra-border)'
      }`}
    >
      <span className="text-[15px] font-semibold text-(--obra-ink)">{a.nome}</span>
      <span className="obra-num text-[14px] text-(--obra-muted-texto)">avanço {pctTexto(a.pct)}</span>
      <span className="mt-1 block h-2 overflow-hidden rounded bg-(--obra-trilho)">
        <i className="block h-full" style={{ width: `${Math.round((a.pct ?? 0) * 100)}%`, background: CORES_FAIXA[a.faixa ?? 0] }} />
      </span>
      {a.impedimentos.length ? (
        <span className="mt-1 w-fit rounded-full bg-[#fdecea] px-2 text-[13px] font-semibold text-(--obra-vermelho-texto)">▲ impedimento aberto</span>
      ) : null}
    </button>
  )
}

export default function MapaPortal({ mapa }: { mapa: MapaCliente }) {
  const [selId, setSelId] = useState<string | null>(mapa.ambientes[0]?.id ?? null)
  const sel = mapa.ambientes.find((a) => a.id === selId) ?? null
  const desenho = mapa.modo !== 'ambientes'

  const cartoes = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {mapa.ambientes.map((a) => (
        <Cartao key={a.id} a={a} sel={a.id === selId} onClick={() => setSelId(a.id)} />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="text-[14px] text-(--obra-muted-texto)">Cor = avanço físico das atividades de cada ambiente. Toque num ambiente para ver o avanço e as fotos.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Mapa da obra" className="min-w-0 rounded-2xl border border-(--obra-border) bg-(--obra-card) p-4 sm:p-6">
          {desenho ? (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-(--obra-border) md:block">
                <DesenhoMapa
                  modo={mapa.modo === 'planta' ? 'planta' : 'croqui'}
                  plantaUrl={mapa.plantaUrl}
                  plantaLargura={mapa.plantaLargura}
                  plantaAltura={mapa.plantaAltura}
                  ambientes={mapa.ambientes.map((a) => ({
                    ...a,
                    detalhe: [pctTexto(a.pct), area(a)].filter(Boolean).join(' · '),
                    impedimento: a.impedimentos.length > 0,
                  }))}
                  pontos={mapa.pontos}
                  selecionado={selId}
                  onSelecionar={setSelId}
                />
              </div>
              <div className="md:hidden">{cartoes}</div>
            </>
          ) : (
            cartoes
          )}
          <LegendaMapa />
        </section>

        <aside aria-label="Ambiente escolhido" className="min-w-0">
          {sel ? (
            <Bloco titulo={sel.nome} id="b-ambiente">
              <p className="obra-num text-[14px] text-(--obra-muted-texto)">
                {[area(sel), `avanço ${pctTexto(sel.pct)}`, sel.previsto !== null ? `previsto ${pctTexto(sel.previsto)}` : null].filter(Boolean).join(' · ')}
              </p>

              {sel.atividades.length ? (
                <ul className="mt-3 divide-y divide-(--obra-border) border-t border-(--obra-border)">
                  {sel.atividades.map((a) => (
                    <li key={a.codigo} className="grid grid-cols-[3rem_1fr] gap-x-3 gap-y-1 py-2.5">
                      <span className="obra-num text-[14px] text-(--obra-muted-texto)">{a.codigo}</span>
                      <span className="text-[15px] text-(--obra-text)">{a.descricao}</span>
                      <span className={`col-start-2 text-[14px] ${TOM[a.tom]}`}>
                        {a.situacao} · <span className="obra-num">{a.realizado}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-(--obra-muted-texto)">
                  {mapa.cronogramaPublicado
                    ? 'Sem atividade do cronograma neste ambiente (—).'
                    : 'Cronograma ainda não publicado: o avanço por atividade aparece aqui quando ele estiver publicado.'}
                </p>
              )}

              {sel.impedimentos.length ? (
                <div className="mt-4">
                  <h3 className="text-[15px] font-semibold text-(--obra-vermelho-texto)">▲ Impedimento aberto</h3>
                  <ul className="mt-1 flex flex-col gap-1 text-[14px] text-(--obra-text)">
                    {sel.impedimentos.map((i) => (
                      <li key={i.id}>{i.descricao}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4">
                <h3 className="text-[15px] font-semibold text-(--obra-ink)">Fotos recentes</h3>
                {sel.fotos.length ? (
                  <ul className="mt-2 grid grid-cols-3 gap-2">
                    {sel.fotos.map((f) => (
                      <li key={f.id} className="relative overflow-hidden rounded-lg border border-(--obra-border) bg-(--obra-trilho)">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage */}
                          <img src={f.url} alt={`Foto de ${dataCurta(f.data)} — ${sel.nome}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                        </a>
                        <span className="obra-num pointer-events-none absolute bottom-1 left-1 rounded bg-[#00345ecc] px-1.5 text-[12px] text-white">
                          {dataCurta(f.data)}
                          {f.pontoNumero !== null ? ` · ponto ${f.pontoNumero}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1">
                    <Vazio>As fotos deste ambiente aparecem aqui assim que os diários de obra forem validados.</Vazio>
                  </div>
                )}
              </div>
            </Bloco>
          ) : (
            <Vazio>Escolha um ambiente no mapa.</Vazio>
          )}
        </aside>
      </div>
    </div>
  )
}
