'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ROTULO_BLOCO, slidesDe, type BlocoId, type ConteudoApresentacao } from '../../_lib/apresentacao'
import CurvaS from '../../_ui/curva-s'
import EvolucaoEtapas from '../../_ui/evolucao-etapas'
import { COR_TOM } from '../../_ui/tema'

export type FotoTela = { url: string; legenda: string | null; data: string }

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const BOTAO =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-(--obra-border) bg-white px-3 text-[14px] font-medium text-(--obra-ink) hover:bg-(--obra-surface) disabled:opacity-40'

function Titulo({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-[28px] leading-tight font-semibold text-(--obra-ink) sm:text-[36px]">{children}</h2>
}

function Lista({ vazio, children }: { vazio?: string; children: ReactNode[] }) {
  if (!children.length) return vazio ? <p className="text-[16px] text-(--obra-muted-texto)">{vazio}</p> : null
  return <ul className="flex flex-col gap-3">{children}</ul>
}

const Item = ({ cor, rotulo, children }: { cor: string; rotulo?: string; children: ReactNode }) => (
  <li className="border-l-4 bg-(--obra-surface) px-4 py-2.5 text-[16px] text-(--obra-text) sm:text-[18px]" style={{ borderColor: cor }}>
    {rotulo ? <span className="mb-0.5 block text-[12px] font-semibold text-(--obra-ink)">{rotulo}</span> : null}
    {children}
  </li>
)

function Conteudo({ bloco, c, fotos }: { bloco: BlocoId; c: ConteudoApresentacao; fotos: FotoTela[] }) {
  switch (bloco) {
    case 'capa':
      return (
        <div className="flex h-full flex-col justify-center">
          <div className="mb-5 h-1 w-24 rounded bg-(--obra-orange)" />
          <h2 className="text-[40px] leading-tight font-semibold text-(--obra-ink) sm:text-[64px]">{c.titulo}</h2>
          {c.cliente ? <p className="mt-3 text-[20px] text-(--obra-text) sm:text-[28px]">{c.cliente}</p> : null}
          <p className="mt-6 text-[16px] text-(--obra-muted-texto) sm:text-[20px]">Apresentação de andamento da obra</p>
          <p className="obra-num mt-1 text-[16px] text-(--obra-muted-texto) sm:text-[20px]">{c.subtitulo}</p>
        </div>
      )
    case 'resumo': {
      const r = c.resumo!
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.resumo}</Titulo>
          <p className="mb-4 flex items-center gap-3 text-[24px] font-semibold text-(--obra-ink) sm:text-[32px]">
            <span aria-hidden className="size-5 rounded-full" style={{ backgroundColor: r.sinal.ponto }} />
            {r.sinal.rotulo}
          </p>
          <p className="mb-3 text-[18px] text-(--obra-text) sm:text-[22px]">{r.avanco.desvio}.</p>
          <p className="mb-3 text-[18px] text-(--obra-text) sm:text-[22px]">
            Previsto até {r.avanco.ate}: <span className="obra-num font-semibold">{r.avanco.previsto}</span> · realizado:{' '}
            <span className="obra-num font-semibold">{r.avanco.realizado}</span>
          </p>
          <p className="text-[18px] text-(--obra-text) sm:text-[22px]">{r.previsao}</p>
        </div>
      )
    }
    case 'curva': {
      const k = c.curva!
      const ultimo = k[k.length - 1].data
      const real = k.filter((p) => p.realizado !== null).map((p) => ({ data: p.data, valor: p.realizado! }))
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.curva}</Titulo>
          <CurvaS
            base={k.some((p) => p.base !== null) ? k.filter((p) => p.base !== null).map((p) => ({ data: p.data, valor: p.base! })) : null}
            previsto={k.map((p) => ({ data: p.data, valor: p.previsto }))}
            realizado={real}
            hoje={ultimo}
            dadosAte={real.length ? real[real.length - 1].data : null}
          />
        </div>
      )
    }
    case 'cronograma':
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.cronograma}</Titulo>
          <EvolucaoEtapas linhas={c.cronograma!} />
        </div>
      )
    case 'marcos': {
      const m = c.marcos!
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.marcos}</Titulo>
          <Lista>
            {[
              ...m.destaques.map((h, i) => (
                <Item key={`h${i}`} cor="var(--obra-orange)">
                  {h}
                </Item>
              )),
              ...m.marcos.map((x, i) => (
                <Item key={`m${i}`} cor="var(--obra-ink)" rotulo={`Marco · ${x.etapa}`}>
                  Real {x.real}
                  {x.base ? ` · base ${x.base}` : ''}
                  {x.desvio ? ` · ${x.desvio}` : ''}
                </Item>
              )),
            ]}
          </Lista>
        </div>
      )
    }
    case 'fotos':
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.fotos}</Titulo>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((f, i) => (
              <li key={i} className="overflow-hidden rounded-lg border border-(--obra-border) bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage */}
                <img src={f.url} alt={f.legenda || `Foto de ${dm(f.data)}`} className="aspect-[4/3] w-full object-cover" />
                <p className="obra-num px-2 py-1 text-[12px] text-(--obra-muted-texto)">
                  {dm(f.data)}
                  {f.legenda ? ` · ${f.legenda}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'impedimentos': {
      const im = c.impedimentos!
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.impedimentos}</Titulo>
          <h3 className="mb-2 text-[18px] font-semibold text-(--obra-ink)">Aguardando vocês</h3>
          <Lista vazio="Nada pendente com vocês.">
            {im.doCliente.map((r, i) => (
              <Item
                key={i}
                cor={r.vencida ? COR_TOM.negativo.cheio : COR_TOM.atencao.cheio}
                rotulo={`${r.tipo}${r.prazo ? ` · prazo ${r.prazo}${r.vencida ? ' (vencido)' : ''}` : ''}`}
              >
                {r.descricao} — atividade {r.atividade}
              </Item>
            ))}
          </Lista>
          <h3 className="mt-5 mb-2 text-[18px] font-semibold text-(--obra-ink)">Impedimentos do período</h3>
          <Lista vazio="Nenhum impedimento no período.">
            {im.impedimentos.map((it, i) => (
              <Item key={i} cor={COR_TOM.negativo.cheio} rotulo={it.rotulo}>
                {it.corpo}
              </Item>
            ))}
          </Lista>
        </div>
      )
    }
    case 'ppc':
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.ppc}</Titulo>
          <p className="obra-num text-[64px] leading-none font-semibold text-(--obra-ink)">{c.ppc!.valor}</p>
          <p className="mt-3 text-[20px] text-(--obra-text)">
            {c.ppc!.semanas} {c.ppc!.semanas === 1 ? 'semana avaliada' : 'semanas avaliadas'} no período
          </p>
        </div>
      )
    case 'proximos':
      return (
        <div>
          <Titulo>{ROTULO_BLOCO.proximos}</Titulo>
          {c.proximos!.map((s) => (
            <section key={s.semana} className="mb-4">
              <h3 className="obra-num mb-2 text-[16px] font-semibold text-(--obra-ink)">Semana de {s.semana}</h3>
              <ul className="flex flex-col gap-1.5">
                {s.itens.map((i, k) => (
                  <li key={k} className="flex gap-3 text-[16px] text-(--obra-text) sm:text-[18px]">
                    <span className="obra-num w-14 shrink-0 text-(--obra-muted-texto)">{i.codigo}</span>
                    <span className="flex-1">{i.nome}</span>
                    <span className="obra-num shrink-0 text-(--obra-muted-texto)">
                      {i.inicio} a {i.termino}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )
  }
}

/** Botão "Apresentar" + tela cheia: um bloco por slide (setas, toque, F, Esc, contador). Não grava nada. */
export default function TelaCheia({ conteudo, fotos }: { conteudo: ConteudoApresentacao; fotos: FotoTela[] }) {
  const slides = slidesDe(conteudo, fotos.length > 0)
  const [aberto, setAberto] = useState(false)
  const [i, setI] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const toque = useRef<{ x: number; y: number } | null>(null)

  const ir = useCallback((n: number) => setI(Math.min(slides.length - 1, Math.max(0, n))), [slides.length])
  const alternarTela = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void raiz.current?.requestFullscreen?.().catch(() => {})
  }, [])
  const fechar = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    setAberto(false)
  }, [])

  useEffect(() => {
    if (!aberto) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    raiz.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') ir(i + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(i - 1)
      else if (e.key === 'Home') ir(0)
      else if (e.key === 'End') ir(slides.length - 1)
      else if (e.key === 'f' || e.key === 'F') alternarTela()
      else if (e.key === 'Escape') fechar()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [aberto, i, ir, alternarTela, fechar, slides.length])

  const iniciar = (e: TouchEvent) => {
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const terminar = (e: TouchEvent) => {
    const t = toque.current
    toque.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ir(i + (dx < 0 ? 1 : -1))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setI(0)
          setAberto(true)
        }}
        className="inline-flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-[14px] font-medium text-white hover:bg-(--obra-ink-escuro)"
      >
        Apresentar em tela cheia
      </button>
      {aberto ? (
        <div
          ref={raiz}
          role="dialog"
          aria-modal="true"
          aria-label="Apresentação ao cliente"
          tabIndex={-1}
          onTouchStart={iniciar}
          onTouchEnd={terminar}
          className="fixed inset-0 z-50 flex flex-col bg-(--obra-card) text-(--obra-text) outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b border-(--obra-border) px-4 py-2">
            <span className="truncate text-[14px] font-semibold text-(--obra-ink)">{conteudo.loja}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={alternarTela} className={BOTAO} aria-label="Tela cheia (tecla F)">
                Tela cheia (F)
              </button>
              <button type="button" onClick={fechar} className={BOTAO} aria-label="Sair da apresentação (tecla Esc)">
                Sair (Esc)
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-12 sm:py-10" aria-live="polite">
            <Conteudo bloco={slides[i]} c={conteudo} fotos={fotos} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-(--obra-border) px-4 py-2">
            <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} className={BOTAO}>
              Anterior
            </button>
            <span className="obra-num text-[14px] text-(--obra-muted-texto)" aria-label={`Slide ${i + 1} de ${slides.length}`}>
              {i + 1} / {slides.length}
            </span>
            <button type="button" onClick={() => ir(i + 1)} disabled={i === slides.length - 1} className={BOTAO}>
              Próximo
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
