'use client'

/**
 * "Montar o mapa" (Leva 6, mockup aprovado): 1. modo; 2. ambientes e pontos de
 * foto (arrastar para criar, mover e redimensionar retângulos; tocar para pôr
 * ponto); 3. atividades do ambiente. Tudo grava na hora, pelas actions
 * (engenheiro/admin conferido no servidor e no banco).
 *
 * Planta: imagem (JPG/PNG/WebP) ou PDF. O PDF vira imagem da 1ª página no
 * navegador (`_pdf-para-imagem`); o servidor só recebe imagem.
 */

import { useRef, useState, type PointerEvent as PE } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ModoMapa } from '../../../_lib/mapa-leitura'
import {
  apagarAmbienteAction,
  atualizarAmbienteAction,
  atualizarPontoAction,
  criarAmbienteAction,
  criarPontoAction,
  definirAtividadesAction,
  definirPontoAtivoAction,
  salvarModoAction,
  salvarPlantaAction,
} from '../_actions'
import { quadroDe } from '../_desenho'
import { pdfParaImagem } from './_pdf-para-imagem'
import { EXTENSAO_PLANTA, LADO_MINIMO, normalizarRetangulo } from '../_regras'
import type { Retangulo } from '../_tipos'

export type AmbienteEditor = {
  id: string
  nome: string
  areaM2: number | null
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  ordem: number
  atividades: number[]
}
export type PontoEditor = { id: string; numero: number; nome: string; ambienteId: string; x: number | null; y: number | null; ativo: boolean }
type Ferramenta = 'selecionar' | 'ambiente' | 'ponto'
type Arrasto =
  | {
      tipo: 'mover' | 'redim'
      id: string
      ini: { x: number; y: number }
      orig: Retangulo
      /** Ao mover, os pontos do ambiente vão junto (posição original de cada um). */
      pontosOrig: { id: string; x: number; y: number }[]
    }
  | { tipo: 'criar'; ini: { x: number; y: number }; atual: Retangulo }
  | { tipo: 'ponto'; id: string; ini: { x: number; y: number }; orig: { x: number; y: number } }

const TAMANHO_MAXIMO_PLANTA = 15 * 1024 * 1024
const TINTA = '#00345e'
const LARANJA = '#f85e0b'
const campo = 'min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-base text-(--obra-text)'
const botao = 'min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-sm text-(--obra-ink) disabled:opacity-45'
const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b)
const retDe = (a: AmbienteEditor): Retangulo | null =>
  a.x !== null && a.y !== null && a.w !== null && a.h !== null ? { x: a.x, y: a.y, w: a.w, h: a.h } : null

function Seg<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: { v: T; r: string }[]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valor === o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-11 rounded-lg border px-3 text-sm ${
            valor === o.v ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'
          }`}
        >
          {o.r}
        </button>
      ))}
    </div>
  )
}

async function lerDimensoes(arquivo: File): Promise<{ largura: number; altura: number }> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok()
      img.onerror = () => erro(new Error('imagem'))
      img.src = url
    })
    return { largura: img.naturalWidth, altura: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function EditorMapa({
  obraId,
  configurado,
  modo: modoInicial,
  planta: plantaInicial,
  ambientes: ambIniciais,
  pontos: ptIniciais,
  atividades,
}: {
  obraId: string
  configurado: boolean
  modo: ModoMapa
  planta: { url: string | null; largura: number | null; altura: number | null }
  ambientes: AmbienteEditor[]
  pontos: PontoEditor[]
  atividades: { numero: number; etapa: string; descricao: string }[]
}) {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [modo, setModo] = useState<ModoMapa | null>(configurado ? modoInicial : null)
  const [planta, setPlanta] = useState(plantaInicial)
  const [ambientes, setAmbientes] = useState(ambIniciais)
  const [pontos, setPontos] = useState(ptIniciais)
  const [selId, setSelId] = useState<string | null>(ambIniciais[0]?.id ?? null)
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar')
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const sel = ambientes.find((a) => a.id === selId) ?? null
  const [form, setForm] = useState<{ id: string | null; nome: string; area: string }>({ id: null, nome: '', area: '' })
  const [marcadas, setMarcadas] = useState<{ id: string | null; numeros: Set<number> }>({ id: null, numeros: new Set() })
  // O formulário acompanha o ambiente escolhido.
  if (sel && form.id !== sel.id) setForm({ id: sel.id, nome: sel.nome, area: sel.areaM2 === null ? '' : String(sel.areaM2).replace('.', ',') })
  if (sel && marcadas.id !== sel.id) setMarcadas({ id: sel.id, numeros: new Set(sel.atividades) })

  const desenhavel = modo === 'planta' || modo === 'croqui'
  const comImagem = modo === 'planta' && !!planta.url
  const { W, H } = quadroDe(comImagem ? 'planta' : 'croqui', planta.largura, planta.altura)
  const u = W / 1000

  async function rodar<T extends { ok: boolean }>(f: () => Promise<T>, okMsg?: string): Promise<T | null> {
    setErro(null)
    setAviso(null)
    setOcupado(true)
    try {
      const r = await f()
      if (!r.ok) {
        setErro((r as unknown as { erro: string }).erro)
        return null
      }
      if (okMsg) setAviso(okMsg)
      return r
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
      return null
    } finally {
      setOcupado(false)
    }
  }

  // ----- 1. modo e planta -----
  async function escolherModo(m: ModoMapa) {
    if (m === 'planta' && !planta.url) {
      setModo('planta')
      return arquivoRef.current?.click()
    }
    const r = await rodar(() => salvarModoAction(obraId, m))
    if (r) {
      setModo(m)
      router.refresh()
    }
  }

  async function enviarPlanta(lista: FileList | null) {
    const arquivo = lista?.[0]
    if (arquivoRef.current) arquivoRef.current.value = ''
    if (!arquivo) return
    setErro(null)
    const ehPdf = arquivo.type === 'application/pdf'
    const ext = EXTENSAO_PLANTA[arquivo.type]
    if (!ehPdf && !ext) return setErro('Envie a planta como imagem JPG, PNG ou WebP, ou como PDF.')
    if (arquivo.size > TAMANHO_MAXIMO_PLANTA) return setErro(`${ehPdf ? 'O PDF' : 'A imagem'} da planta precisa ter até 15 MB.`)
    setOcupado(true)
    try {
      let envio: { blob: Blob; type: string; ext: string; largura: number; altura: number }
      let soPrimeiraPagina = false
      if (ehPdf) {
        try {
          const r = await pdfParaImagem(arquivo)
          envio = r
          soPrimeiraPagina = r.paginas > 1
        } catch {
          return setErro('Não consegui abrir este PDF. Exporte a primeira página como imagem e envie de novo.')
        }
      } else {
        envio = { blob: arquivo, type: arquivo.type, ext, ...(await lerDimensoes(arquivo)) }
      }
      const { largura, altura } = envio
      const path = `${obraId}/mapa/${crypto.randomUUID()}.${envio.ext}`
      const { error } = await createClient().storage.from('obras-fotos').upload(path, envio.blob, { contentType: envio.type })
      if (error) return setErro('Não deu para enviar a planta. Tente de novo.')
      const r = await salvarPlantaAction(obraId, path, largura, altura)
      if (!r.ok) return setErro(r.erro)
      setPlanta({ url: URL.createObjectURL(envio.blob), largura, altura })
      setModo('planta')
      setAviso(soPrimeiraPagina ? 'Planta enviada. Usei só a 1ª página do PDF.' : 'Planta enviada.')
      router.refresh()
    } catch {
      setErro('Não deu para ler a imagem da planta.')
    } finally {
      setOcupado(false)
    }
  }

  // ----- 2. ambientes e pontos -----
  const proximoNome = () => `Ambiente ${ambientes.length + 1}`

  async function criarAmbiente(ret: Retangulo | null) {
    const nome = proximoNome()
    const r = await rodar(() => criarAmbienteAction(obraId, { nome, areaM2: null, retangulo: ret }))
    if (!r?.id) return
    const n = ret ? normalizarRetangulo(ret) : null
    setAmbientes((l) => [...l, { id: r.id!, nome, areaM2: null, x: n?.x ?? null, y: n?.y ?? null, w: n?.w ?? null, h: n?.h ?? null, ordem: l.length + 1, atividades: [] }])
    setSelId(r.id)
    setFerramenta('selecionar')
  }

  async function criarPonto(ambienteId: string, pos: { x: number; y: number } | null) {
    const amb = ambientes.find((a) => a.id === ambienteId)
    const nome = amb ? amb.nome : 'Ponto'
    const r = await rodar(() => criarPontoAction(obraId, { nome, ambienteId, x: pos?.x ?? null, y: pos?.y ?? null }))
    if (!r?.id) return
    setPontos((l) => [...l, { id: r.id!, numero: r.numero ?? l.length + 1, nome, ambienteId, x: pos?.x ?? null, y: pos?.y ?? null, ativo: true }])
    setFerramenta('selecionar')
  }

  async function salvarAmbiente() {
    if (!sel) return
    const area = form.area.trim() ? Number(form.area.replace(/\./g, '').replace(',', '.')) : null
    if (area !== null && !Number.isFinite(area)) return setErro('Área inválida')
    const r = await rodar(() => atualizarAmbienteAction(sel.id, { nome: form.nome, areaM2: area }), 'Ambiente salvo.')
    if (r) setAmbientes((l) => l.map((a) => (a.id === sel.id ? { ...a, nome: form.nome.trim(), areaM2: area } : a)))
  }

  async function apagarAmbiente() {
    if (!sel || !window.confirm(`Apagar o ambiente "${sel.nome}"? Os pontos dele também saem.`)) return
    const r = await rodar(() => apagarAmbienteAction(sel.id), 'Ambiente apagado.')
    if (!r) return
    setAmbientes((l) => l.filter((a) => a.id !== sel.id))
    setPontos((l) => l.filter((p) => p.ambienteId !== sel.id))
    setSelId(null)
  }

  async function salvarAtividades() {
    if (!sel) return
    const numeros = [...marcadas.numeros].sort((a, b) => a - b)
    const r = await rodar(() => definirAtividadesAction(sel.id, numeros), 'Atividades do ambiente salvas.')
    if (r) setAmbientes((l) => l.map((a) => (a.id === sel.id ? { ...a, atividades: numeros } : a)))
  }

  async function salvarPonto(p: PontoEditor, patch: Partial<Pick<PontoEditor, 'nome' | 'ambienteId'>>) {
    const r = await rodar(() => atualizarPontoAction(p.id, patch), 'Ponto salvo.')
    if (r) setPontos((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
  }

  async function alternarPonto(p: PontoEditor) {
    const r = await rodar(() => definirPontoAtivoAction(p.id, !p.ativo), p.ativo ? 'Ponto desativado.' : 'Ponto reativado.')
    if (r) setPontos((l) => l.map((x) => (x.id === p.id ? { ...x, ativo: !p.ativo } : x)))
  }

  // ----- arrastar no desenho -----
  function rel(e: PE): { x: number; y: number } {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }
  function capturar(e: PE) {
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* navegador sem captura: o arrasto segue enquanto o ponteiro estiver no desenho */
    }
  }

  function noFundo(e: PE) {
    if (ocupado) return
    const p = rel(e)
    if (ferramenta === 'ambiente') {
      capturar(e)
      setArrasto({ tipo: 'criar', ini: p, atual: { x: p.x, y: p.y, w: 0, h: 0 } })
    } else if (ferramenta === 'ponto') {
      const dentro = [...ambientes].reverse().find((a) => {
        const r = retDe(a)
        return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      })
      const alvo = dentro?.id ?? selId
      if (!alvo) return setErro('Toque dentro de um ambiente para pôr o ponto.')
      void criarPonto(alvo, p)
    } else setSelId(null)
  }

  function noAmbiente(e: PE, a: AmbienteEditor, tipo: 'mover' | 'redim') {
    if (ferramenta !== 'selecionar' || ocupado) return
    e.stopPropagation()
    const orig = retDe(a)
    setSelId(a.id)
    if (!orig) return
    capturar(e)
    const pontosOrig =
      tipo === 'mover'
        ? pontos.filter((p) => p.ambienteId === a.id && p.x !== null && p.y !== null).map((p) => ({ id: p.id, x: p.x!, y: p.y! }))
        : []
    setArrasto({ tipo, id: a.id, ini: rel(e), orig, pontosOrig })
  }

  function noPonto(e: PE, p: PontoEditor) {
    if (ferramenta !== 'selecionar' || ocupado || p.x === null || p.y === null) return
    e.stopPropagation()
    setSelId(p.ambienteId)
    capturar(e)
    setArrasto({ tipo: 'ponto', id: p.id, ini: rel(e), orig: { x: p.x, y: p.y } })
  }

  function mover(e: PE) {
    if (!arrasto) return
    const p = rel(e)
    const dx = p.x - arrasto.ini.x
    const dy = p.y - arrasto.ini.y
    if (arrasto.tipo === 'criar') {
      const x = Math.min(arrasto.ini.x, p.x)
      const y = Math.min(arrasto.ini.y, p.y)
      return setArrasto({ ...arrasto, atual: { x, y, w: Math.abs(dx), h: Math.abs(dy) } })
    }
    if (arrasto.tipo === 'ponto') {
      const nx = clamp(arrasto.orig.x + dx)
      const ny = clamp(arrasto.orig.y + dy)
      return setPontos((l) => l.map((x) => (x.id === arrasto.id ? { ...x, x: nx, y: ny } : x)))
    }
    const o = arrasto.orig
    const r =
      arrasto.tipo === 'mover'
        ? { ...o, x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) }
        : { ...o, w: clamp(o.w + dx, LADO_MINIMO, 1 - o.x), h: clamp(o.h + dy, LADO_MINIMO, 1 - o.y) }
    setAmbientes((l) => l.map((a) => (a.id === arrasto.id ? { ...a, ...r } : a)))
    if (arrasto.pontosOrig.length) {
      // mesmo deslocamento que o retângulo de fato andou (já encaixado no quadro)
      const ddx = r.x - o.x
      const ddy = r.y - o.y
      const pos = new Map(arrasto.pontosOrig.map((p) => [p.id, { x: clamp(p.x + ddx), y: clamp(p.y + ddy) }]))
      setPontos((l) => l.map((x) => (pos.has(x.id) ? { ...x, ...pos.get(x.id)! } : x)))
    }
  }

  /** Gesto cancelado (rolagem/sistema no tablet): volta tudo ao original, sem gravar. */
  function cancelar() {
    const a = arrasto
    setArrasto(null)
    if (!a || a.tipo === 'criar') return
    if (a.tipo === 'ponto') return setPontos((l) => l.map((x) => (x.id === a.id ? { ...x, ...a.orig } : x)))
    const voltar = new Map(a.pontosOrig.map((p) => [p.id, p]))
    setAmbientes((l) => l.map((x) => (x.id === a.id ? { ...x, ...a.orig } : x)))
    if (voltar.size) setPontos((l) => l.map((x) => (voltar.has(x.id) ? { ...x, x: voltar.get(x.id)!.x, y: voltar.get(x.id)!.y } : x)))
  }

  async function soltar() {
    const a = arrasto
    if (!a) return
    setArrasto(null)
    if (a.tipo === 'criar') {
      if (a.atual.w < 0.02 || a.atual.h < 0.02) return setAviso('Arraste para desenhar o retângulo do ambiente.')
      return criarAmbiente(a.atual)
    }
    if (a.tipo === 'ponto') {
      const p = pontos.find((x) => x.id === a.id)
      if (!p || (p.x === a.orig.x && p.y === a.orig.y)) return
      const r = await rodar(() => atualizarPontoAction(a.id, { x: p.x, y: p.y }))
      if (!r) setPontos((l) => l.map((x) => (x.id === a.id ? { ...x, ...a.orig } : x)))
      return
    }
    const amb = ambientes.find((x) => x.id === a.id)
    const ret = amb ? retDe(amb) : null
    if (!ret || (ret.x === a.orig.x && ret.y === a.orig.y && ret.w === a.orig.w && ret.h === a.orig.h)) return
    const r = await rodar(() => atualizarAmbienteAction(a.id, { retangulo: ret }))
    if (!r) {
      setAmbientes((l) => l.map((x) => (x.id === a.id ? { ...x, ...a.orig } : x)))
      const voltar = new Map(a.pontosOrig.map((p) => [p.id, p]))
      if (voltar.size) setPontos((l) => l.map((x) => (voltar.has(x.id) ? { ...x, x: voltar.get(x.id)!.x, y: voltar.get(x.id)!.y } : x)))
      return
    }
    // Pontos que foram junto com o ambiente.
    for (const po of a.pontosOrig) {
      const p = pontos.find((x) => x.id === po.id)
      if (p && p.x !== null && p.y !== null && (p.x !== po.x || p.y !== po.y)) {
        const rp = await rodar(() => atualizarPontoAction(po.id, { x: p.x, y: p.y }))
        if (!rp) setPontos((l) => l.map((x) => (x.id === po.id ? { ...x, x: po.x, y: po.y } : x)))
      }
    }
  }

  const pontosSel = sel ? pontos.filter((p) => p.ambienteId === sel.id) : []
  const semDesenho = ambientes.filter((a) => !retDe(a))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">Montar o mapa</h2>
          <p className="text-sm text-(--obra-muted-texto)">
            Engenheiro da obra ou admin. Dá para trocar de modo depois, sem perder nada. Tudo é salvo na hora.
          </p>
        </div>
        <Link href={`/obras/obras/${obraId}/mapa`} className="flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-sm font-semibold text-white">
          Ver o mapa
        </Link>
      </header>

      {erro ? <p role="alert" className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-(--obra-vermelho-texto)">{erro}</p> : null}
      {aviso ? <p role="status" className="text-sm text-(--obra-verde-texto)">{aviso}</p> : null}

      <section className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
        <h3 className="mb-2 font-semibold text-(--obra-ink)">1. Modo do mapa</h3>
        <Seg<ModoMapa>
          rotulo="Modo do mapa"
          valor={modo ?? ('' as ModoMapa)}
          onChange={(m) => void escolherModo(m)}
          opcoes={[
            { v: 'planta', r: 'Planta (enviar imagem ou PDF do layout)' },
            { v: 'croqui', r: 'Croqui (desenhar retângulos)' },
            { v: 'ambientes', r: 'Só ambientes (sem desenho)' },
          ]}
        />
        <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => void enviarPlanta(e.target.files)} />
        {modo === 'planta' ? (
          <button type="button" disabled={ocupado} onClick={() => arquivoRef.current?.click()} className={`${botao} mt-2`}>
            {planta.url ? 'Trocar a planta (imagem ou PDF)' : 'Enviar a planta (imagem ou PDF)'}
          </button>
        ) : null}
        <p className="mt-2 text-sm text-(--obra-muted-texto)">
          Planta: envie o layout aprovado como imagem (JPG, PNG ou WebP) ou PDF (usamos só a 1ª página). No celular, o mapa vira a lista de ambientes.
        </p>
      </section>

      {modo ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="min-w-0 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
            <h3 className="mb-2 font-semibold text-(--obra-ink)">2. Ambientes e pontos de foto</h3>
            {desenhavel ? (
              <>
                <Seg<Ferramenta>
                  rotulo="Ferramenta"
                  valor={ferramenta}
                  onChange={setFerramenta}
                  opcoes={[
                    { v: 'selecionar', r: 'Escolher e arrastar' },
                    { v: 'ambiente', r: '+ Ambiente (arraste no desenho)' },
                    { v: 'ponto', r: '+ Ponto de foto (toque no ambiente)' },
                  ]}
                />
                <div className="mt-3 overflow-hidden rounded-lg border border-(--obra-border)">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="block h-auto w-full select-none"
                    style={{ touchAction: 'none' }}
                    role="application"
                    aria-label="Editor de ambientes: arraste para criar, mover ou redimensionar"
                    onPointerDown={noFundo}
                    onPointerMove={mover}
                    onPointerUp={() => void soltar()}
                    onPointerCancel={cancelar}
                  >
                    <rect width={W} height={H} fill="#f7f9fc" />
                    {comImagem ? <image href={planta.url!} width={W} height={H} preserveAspectRatio="none" /> : null}
                    {ambientes.map((a) => {
                      const r = retDe(a)
                      if (!r) return null
                      const s = a.id === selId
                      return (
                        <g key={a.id} data-ambiente={a.id}>
                          <rect
                            x={r.x * W}
                            y={r.y * H}
                            width={r.w * W}
                            height={r.h * H}
                            fill={s ? '#5d9fdc55' : '#9cc6ee44'}
                            stroke={s ? LARANJA : TINTA}
                            strokeWidth={(s ? 3 : 1.5) * u}
                            className={ferramenta === 'selecionar' ? 'cursor-move' : undefined}
                            onPointerDown={(e) => noAmbiente(e, a, 'mover')}
                          />
                          <text x={r.x * W + 12 * u} y={r.y * H + 24 * u} fontSize={15 * u} fontWeight={600} fill={TINTA} pointerEvents="none">
                            {a.nome}
                          </text>
                          {s ? (
                            <g data-alca="redimensionar" className="cursor-nwse-resize" onPointerDown={(e) => noAmbiente(e, a, 'redim')}>
                              {/* alvo de toque invisível ≥ 44 px no tamanho usual do editor */}
                              <rect x={(r.x + r.w) * W - 32 * u} y={(r.y + r.h) * H - 32 * u} width={64 * u} height={64 * u} fill="transparent" />
                              <rect
                                x={(r.x + r.w) * W - 12 * u}
                                y={(r.y + r.h) * H - 12 * u}
                                width={24 * u}
                                height={24 * u}
                                fill="#ffffff"
                                stroke={LARANJA}
                                strokeWidth={2 * u}
                                pointerEvents="none"
                              />
                            </g>
                          ) : null}
                        </g>
                      )
                    })}
                    {arrasto?.tipo === 'criar' ? (
                      <rect
                        x={arrasto.atual.x * W}
                        y={arrasto.atual.y * H}
                        width={arrasto.atual.w * W}
                        height={arrasto.atual.h * H}
                        fill="#f85e0b22"
                        stroke={LARANJA}
                        strokeWidth={2 * u}
                        strokeDasharray={`${6 * u} ${4 * u}`}
                      />
                    ) : null}
                    {pontos
                      .filter((p) => p.x !== null && p.y !== null)
                      .map((p) => (
                        <g key={p.id} data-ponto={p.id} onPointerDown={(e) => noPonto(e, p)} className={ferramenta === 'selecionar' ? 'cursor-move' : undefined} opacity={p.ativo ? 1 : 0.4}>
                          {/* alvo de toque invisível ≥ 44 px no tamanho usual do editor */}
                          <circle cx={p.x! * W} cy={p.y! * H} r={32 * u} fill="transparent" />
                          <circle cx={p.x! * W} cy={p.y! * H} r={16 * u} fill="#ffffff" stroke={TINTA} strokeWidth={2 * u} pointerEvents="none" />
                          <text x={p.x! * W} y={p.y! * H + 5 * u} textAnchor="middle" fontSize={13 * u} fontWeight={600} fill={TINTA} pointerEvents="none" className="obra-num">
                            {p.numero}
                          </text>
                        </g>
                      ))}
                  </svg>
                </div>
              </>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={ocupado} className={botao} onClick={() => void criarAmbiente(desenhavel ? { x: 0.35, y: 0.35, w: 0.3, h: 0.3 } : null)}>
                + Ambiente
              </button>
              <button type="button" disabled={ocupado || !sel} className={botao} onClick={() => sel && void criarPonto(sel.id, desenhavel && retDe(sel) ? { x: sel.x! + sel.w! / 2, y: sel.y! + sel.h! / 2 } : null)}>
                + Ponto de foto no ambiente escolhido
              </button>
            </div>
            <ul aria-label="Ambientes" className="mt-3 flex flex-wrap gap-2">
              {ambientes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={a.id === selId}
                    onClick={() => setSelId(a.id)}
                    className={`min-h-11 rounded-full border px-3 text-sm ${a.id === selId ? 'border-(--obra-orange-texto) font-semibold text-(--obra-orange-texto)' : 'border-(--obra-border) text-(--obra-text)'}`}
                  >
                    {a.nome}
                  </button>
                </li>
              ))}
            </ul>
            {desenhavel && semDesenho.length ? (
              <p className="mt-2 text-xs text-(--obra-muted-texto)">
                Sem desenho: {semDesenho.map((a) => a.nome).join(', ')}. Escolha e use &quot;Pôr no desenho&quot;.
              </p>
            ) : null}
          </section>

          <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
            {sel ? (
              <>
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-(--obra-ink)">Ambiente escolhido</h3>
                  <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
                    Nome
                    <input value={form.nome} maxLength={120} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
                    Área em m² (opcional)
                    <input value={form.area} inputMode="decimal" onChange={(e) => setForm({ ...form, area: e.target.value })} className={campo} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={ocupado} onClick={() => void salvarAmbiente()} className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45">
                      Salvar ambiente
                    </button>
                    {desenhavel && !retDe(sel) ? (
                      <button
                        type="button"
                        disabled={ocupado}
                        className={botao}
                        onClick={async () => {
                          const ret = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 }
                          const r = await rodar(() => atualizarAmbienteAction(sel.id, { retangulo: ret }))
                          if (r) setAmbientes((l) => l.map((a) => (a.id === sel.id ? { ...a, ...ret } : a)))
                        }}
                      >
                        Pôr no desenho
                      </button>
                    ) : null}
                    <button type="button" disabled={ocupado} onClick={() => void apagarAmbiente()} className="min-h-11 rounded-lg border border-(--obra-vermelho-texto) px-3 text-sm text-(--obra-vermelho-texto) disabled:opacity-45">
                      Apagar ambiente
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-(--obra-ink)">Pontos de foto deste ambiente</h4>
                  {pontosSel.length ? (
                    <ul className="flex flex-col gap-2">
                      {pontosSel.map((p) => (
                        <LinhaPonto key={p.id} p={p} ambientes={ambientes} ocupado={ocupado} onSalvar={salvarPonto} onAlternar={alternarPonto} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-(--obra-muted-texto)">Nenhum ponto ainda.</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-(--obra-ink)">3. Atividades do ambiente</h3>
                  <p className="text-sm text-(--obra-muted-texto)">
                    Marque as atividades do cronograma que acontecem aqui. Uma atividade pode estar em mais de um ambiente.
                  </p>
                  {atividades.length ? (
                    <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
                      {atividades.map((a) => (
                        <li key={a.numero}>
                          <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-(--obra-border) px-3 text-sm">
                            <span className="min-w-0">
                              <span className="obra-num">{a.numero}</span> {a.descricao}
                              <span className="block text-xs text-(--obra-muted-texto)">{a.etapa}</span>
                            </span>
                            <input
                              type="checkbox"
                              className="h-5 w-5 shrink-0"
                              checked={marcadas.numeros.has(a.numero)}
                              onChange={(e) => {
                                const n = new Set(marcadas.numeros)
                                if (e.target.checked) n.add(a.numero)
                                else n.delete(a.numero)
                                setMarcadas({ id: sel.id, numeros: n })
                              }}
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-(--obra-muted-texto)">Sem cronograma salvo: as atividades aparecem quando a base for salva.</p>
                  )}
                  <button type="button" disabled={ocupado || !atividades.length} onClick={() => void salvarAtividades()} className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45">
                    Salvar atividades
                  </button>
                  <p className="text-xs text-(--obra-muted-texto)">
                    Avanço do ambiente = média das atividades ligadas, ponderada pelo mesmo peso do cronograma (valor ou duração).
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-(--obra-muted-texto)">Escolha ou crie um ambiente.</p>
            )}
          </section>
        </div>
      ) : (
        <p className="text-sm text-(--obra-muted-texto)">Escolha o modo para começar.</p>
      )}
    </div>
  )
}

function LinhaPonto({
  p,
  ambientes,
  ocupado,
  onSalvar,
  onAlternar,
}: {
  p: PontoEditor
  ambientes: AmbienteEditor[]
  ocupado: boolean
  onSalvar: (p: PontoEditor, patch: Partial<Pick<PontoEditor, 'nome' | 'ambienteId'>>) => void
  onAlternar: (p: PontoEditor) => void
}) {
  const [nome, setNome] = useState(p.nome)
  return (
    <li className={`flex flex-col gap-2 rounded-lg border border-(--obra-border) p-2 ${p.ativo ? '' : 'opacity-60'}`}>
      <span className="obra-num text-sm font-semibold text-(--obra-ink)">
        Ponto {p.numero}
        {p.ativo ? '' : ' · desativado'}
      </span>
      <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
        Nome do ponto
        <input value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
        Ambiente
        <select value={p.ambienteId} onChange={(e) => onSalvar(p, { ambienteId: e.target.value })} disabled={ocupado} className={campo}>
          {ambientes.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado || !nome.trim() || nome === p.nome} onClick={() => onSalvar(p, { nome: nome.trim() })} className={botao}>
          Salvar nome
        </button>
        <button type="button" disabled={ocupado} onClick={() => onAlternar(p)} className={botao}>
          {p.ativo ? 'Desativar ponto' : 'Reativar ponto'}
        </button>
      </div>
    </li>
  )
}
