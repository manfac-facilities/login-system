'use client'

/**
 * Tela do cronograma da OBRA (spec Leva 1 §5): barra de ferramentas, árvore à
 * esquerda (redimensionável, ~55%) e Gantt à direita com rolagem vertical
 * sincronizada. Abaixo de 1024px, só a árvore (com a barrinha de % na linha).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type KeyboardEvent, type PointerEvent, type UIEvent } from 'react'
import { useRouter } from 'next/navigation'
import Arvore, { dataBR, type Edicoes, type LinhaVisivel } from './_arvore'
import BarraFerramentas, { type Escala } from './_barra-ferramentas'
import Gantt from './_gantt'
import {
  criarRevisaoAction,
  definirFimAction,
  definirInicioAction,
  salvarLinhaRascunhoAction,
  salvarVersaoAction,
} from './_actions'
import type { DadosCronograma, LinhaAtividade, LinhaPlano, Resultado } from './_tipos'

const chaveAberto = (obraId: string) => `obras:crono:aberto:${obraId}`

/** Etapas recolhidas, lembradas por obra no navegador (falha silenciosa: é só conforto). */
function lerBruto(obraId: string): string | null {
  try {
    return window.localStorage.getItem(chaveAberto(obraId))
  } catch {
    return null
  }
}
function conjuntoDe(bruto: string | null): Set<string> {
  try {
    const lista: unknown = bruto ? JSON.parse(bruto) : []
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}
const assinarStorage = (avisar: () => void) => {
  window.addEventListener('storage', avisar)
  return () => window.removeEventListener('storage', avisar)
}
function gravarFechadas(obraId: string, fechadas: Set<string>) {
  try {
    window.localStorage.setItem(chaveAberto(obraId), JSON.stringify([...fechadas]))
  } catch {
    /* sem storage (aba privada): segue sem lembrar */
  }
}

const planoDaLinha = (a: LinhaAtividade): LinhaPlano => ({
  numero: a.numero,
  etapa: a.etapa,
  descricao: a.descricao,
  pred1: a.pred1,
  pred2: a.pred2,
  duracao: a.duracao,
  bloqueiaPorTrava: a.bloqueiaPorTrava,
})

export default function TelaCronograma({ dados }: { dados: DadosCronograma }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  // O salvo só é lido no navegador (no servidor, tudo aberto) — sem divergir na hidratação.
  const salvo = useSyncExternalStore(assinarStorage, () => lerBruto(dados.obraId), () => null)
  const [local, setLocal] = useState<Set<string> | null>(null)
  const fechadas = useMemo(() => local ?? conjuntoDe(salvo), [local, salvo])
  const [mostrarBase, setMostrarBase] = useState(true)
  const [escala, setEscala] = useState<Escala>('semana')
  const [foco, setFoco] = useState<string | null>(null)
  const [split, setSplit] = useState(55)
  const [statusAberto, setStatusAberto] = useState(false)

  const { obraId } = dados
  const mudarFechadas = (f: Set<string>) => {
    setLocal(f)
    gravarFechadas(obraId, f)
  }
  const alternar = (chave: string) => {
    const f = new Set(fechadas)
    if (f.has(chave)) f.delete(chave)
    else f.add(chave)
    mudarFechadas(f)
  }

  const porNumero = useMemo(() => new Map(dados.atividades.map((a) => [a.numero, a])), [dados.atividades])
  const linhas = useMemo<LinhaVisivel[]>(() => {
    const r: LinhaVisivel[] = []
    for (const e of dados.etapas) {
      const aberta = !fechadas.has(e.chave)
      r.push({ tipo: 'etapa', etapa: e, aberta })
      if (aberta) for (const n of e.numeros) r.push({ tipo: 'atividade', atividade: porNumero.get(n)!, cor: e.cor })
    }
    return r
  }, [dados.etapas, fechadas, porNumero])

  const executar = (fn: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null)
      const r = await fn()
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      depois?.()
      router.refresh()
    })

  const versaoId = dados.versao.id
  const salvarPlano = (numero: number, campos: Partial<LinhaPlano>) => {
    const a = porNumero.get(numero)
    if (!a) return
    executar(() => salvarLinhaRascunhoAction(obraId, versaoId, { ...planoDaLinha(a), ...campos }))
  }
  const edicoes: Edicoes = {
    descricao: (n, v) => salvarPlano(n, { descricao: v }),
    duracao: (n, v) => salvarPlano(n, { duracao: v }),
    trava: (n, v) => salvarPlano(n, { bloqueiaPorTrava: v }),
    predecessoras: (n, p) => {
      if (!p) return setErro('Predecessoras: até duas, em números separados por vírgula (ex.: 3, 5)')
      salvarPlano(n, { pred1: p[0], pred2: p[1] })
    },
    inicio: (n, d) => executar(() => definirInicioAction(obraId, versaoId, n, d)),
    fim: (n, d) => executar(() => definirFimAction(obraId, versaoId, n, d)),
  }

  // Rolagem vertical sincronizada entre árvore e Gantt.
  const arvoreRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<HTMLDivElement>(null)
  const copiarTopo = (de: HTMLDivElement, para: HTMLDivElement | null) => {
    if (para && Math.abs(para.scrollTop - de.scrollTop) > 1) para.scrollTop = de.scrollTop
  }
  const aoRolarArvore = (e: UIEvent<HTMLDivElement>) => copiarTopo(e.currentTarget, ganttRef.current)
  const aoRolarGantt = (e: UIEvent<HTMLDivElement>) => copiarTopo(e.currentTarget, arvoreRef.current)

  const irParaHoje = useCallback(() => {
    const g = ganttRef.current
    if (!g) return
    const x = Number(g.dataset.xHoje ?? 0)
    g.scrollLeft = Math.max(0, x - g.clientWidth / 3)
  }, [])
  useEffect(() => {
    irParaHoje()
  }, [escala, irParaHoje])

  // Divisória arrastável entre árvore e Gantt (mouse/toque e setas do teclado).
  const areaRef = useRef<HTMLDivElement>(null)
  const limitar = (v: number) => Math.min(80, Math.max(30, v))
  const arrastar = (e: PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current
    if (!area) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const mover = (ev: globalThis.PointerEvent) => {
      const r = area.getBoundingClientRect()
      setSplit(limitar(((ev.clientX - r.left) / r.width) * 100))
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  const teclaDivisoria = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setSplit((s) => limitar(s - 3))
    if (e.key === 'ArrowRight') setSplit((s) => limitar(s + 3))
  }

  const { versao, rascunho, termino } = dados
  const somenteLeitura = versao.salva && rascunho ? `v${versao.numero} é uma versão salva — só leitura.` : null

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <BarraFerramentas
        versoes={dados.versoes}
        versaoNumero={versao.numero}
        onVersao={(n) => router.push(`?v=${n}`)}
        onExpandirTudo={() => mudarFechadas(new Set())}
        onRecolherTudo={() => mudarFechadas(new Set(dados.etapas.map((e) => e.chave)))}
        temBase={dados.temBase}
        mostrarBase={mostrarBase}
        onMostrarBase={setMostrarBase}
        escala={escala}
        onEscala={setEscala}
        onHoje={irParaHoje}
        podeEditar={dados.podeEditar}
        rascunho={rascunho}
        temVigente={dados.temVigente}
        pendente={pendente}
        onAtualizarStatus={() => setStatusAberto(true)}
        onNovaRevisao={() => executar(() => criarRevisaoAction(obraId))}
        onSalvarVersao={(motivo, depois) => rascunho && executar(() => salvarVersaoAction(obraId, rascunho.id, motivo), depois)}
      />

      <p className="obra-num flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-(--obra-muted-texto)">
        <span>Término base: <b className="text-(--obra-text)">{dataBR(termino.base)}</b></span>
        <span>Previsto (v{versao.numero}): <b className="text-(--obra-text)">{dataBR(termino.previsto)}</b></span>
        <span>Projetado: <b className="text-(--obra-text)">{dataBR(termino.projetado)}</b></span>
        {pendente ? <span aria-live="polite">Salvando…</span> : null}
      </p>

      {rascunho && versao.id === rascunho.id && dados.temVigente ? (
        <p className="rounded-lg border border-[#efd77a] bg-[#fdf6d8] px-3 py-2 text-[13px] text-(--obra-yellow-texto)">
          Revisão v{rascunho.numero} em rascunho — painel e diário seguem a versão vigente até ela ser salva.
        </p>
      ) : null}
      {rascunho && rascunho.numero === 1 && versao.id === rascunho.id ? (
        <p className="rounded-lg border border-[#efd77a] bg-[#fdf6d8] px-3 py-2 text-[13px] text-(--obra-yellow-texto)">
          Base (v1) ainda não salva — ajuste as datas e clique em “Salvar base”.
        </p>
      ) : null}
      {somenteLeitura ? <p className="text-[13px] text-(--obra-muted-texto)">{somenteLeitura}</p> : null}
      {erro ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-[#efc2c2] bg-[#fbecec] px-3 py-2 text-[13px] text-(--obra-vermelho-texto)">
          <span>{erro}</span>
          <button type="button" className="min-h-6 font-medium underline" onClick={() => setErro(null)}>
            Fechar
          </button>
        </div>
      ) : null}

      {/* TASK 6: trocar este aviso pela gaveta "Atualizar status". */}
      {statusAberto ? (
        <div role="dialog" aria-label="Atualizar status" className="flex items-center justify-between gap-3 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 py-2 text-[13px] text-(--obra-text)">
          <span>A atualização de status em lote chega na próxima entrega.</span>
          <button type="button" className="min-h-11 px-2 font-medium text-(--obra-ink) underline" onClick={() => setStatusAberto(false)}>
            Fechar
          </button>
        </div>
      ) : null}

      <div
        ref={areaRef}
        className="flex min-w-0 overflow-hidden rounded-xl border border-(--obra-border) bg-(--obra-card) lg:h-[calc(100vh-300px)] lg:min-h-[440px]"
        style={{ ['--split' as string]: `${split}%` }}
      >
        <div className="w-full min-w-0 lg:w-(--split) lg:shrink-0">
          <Arvore
            linhas={linhas}
            editavel={dados.editavel}
            pendente={pendente}
            onAlternar={alternar}
            edicoes={edicoes}
            foco={foco}
            onFoco={setFoco}
            rolagemRef={arvoreRef}
            onRolar={aoRolarArvore}
          />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Largura da tabela"
          aria-valuenow={Math.round(split)}
          aria-valuemin={30}
          aria-valuemax={80}
          tabIndex={0}
          onPointerDown={arrastar}
          onKeyDown={teclaDivisoria}
          className="hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-(--obra-border) hover:bg-(--obra-muted) lg:block"
        />
        <div className="hidden min-w-0 flex-1 lg:block">
          <Gantt
            linhas={linhas}
            feriados={dados.feriados}
            hoje={dados.hoje}
            escala={escala}
            mostrarBase={mostrarBase && dados.temBase}
            foco={foco}
            onFoco={setFoco}
            rolagemRef={ganttRef}
            onRolar={aoRolarGantt}
          />
        </div>
      </div>

      <Legenda temBase={dados.temBase} />
    </div>
  )
}

function Legenda({ temBase }: { temBase: boolean }) {
  const item = 'inline-flex items-center gap-1.5'
  return (
    <ul className="hidden flex-wrap gap-x-5 gap-y-1 text-[12px] text-(--obra-muted-texto) lg:flex" aria-label="Legenda do Gantt">
      <li className={item}><span aria-hidden="true" className="h-3 w-6 rounded-sm bg-[#b6cadb]" /> Previsto</li>
      <li className={item}><span aria-hidden="true" className="h-3 w-6 rounded-sm bg-(--obra-orange)" /> Realizado (%)</li>
      <li className={item}><span aria-hidden="true" className="obra-hachura h-3 w-6 rounded-sm border border-(--obra-vermelho)" /> Projeção além do previsto</li>
      {temBase ? <li className={item}><span aria-hidden="true" className="h-2 w-6 rounded-sm border border-dashed border-(--obra-base)" /> Base (v1)</li> : null}
      <li className={item}><span aria-hidden="true" className="h-3 w-0.5 bg-(--obra-orange)" /> Hoje</li>
      <li className={item}><span aria-hidden="true" className="h-2 w-6 bg-(--obra-ink)" /> Etapa</li>
    </ul>
  )
}
