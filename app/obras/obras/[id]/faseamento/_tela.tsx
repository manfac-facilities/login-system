'use client'

/**
 * Tela da planta de faseamento (Leva 6b §4, mockup aprovado): lista de fases,
 * fase escolhida com as abas "Editar camadas" e "Prancha A3", e os botões
 * Salvar rascunho, Emitir revisão (confirmação na página), Nova revisão, Gerar
 * PDF e Enviar ao cliente. Quem não pode fasear, e toda revisão emitida, fica em
 * leitura (o servidor recusa mesmo assim). Editor só em tela ≥ 768 px; no
 * celular, a prévia e o PDF.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MAX_REGRAS, MAX_TEXTO_REGRA, camadasSchema, carimboSchema, regrasSchema, type Camada, type Carimbo } from './_lib/camadas'
import { criarFaseAction, emitirRevisaoAction, enviarFaseamentoAction, novaRevisaoAction, salvarRascunhoAction } from './_actions'
import { DesenhoFase } from './_desenho'
import EditorCamadas from './_editor'
import PreviaPrancha from './_previa'
import { AVISO_FORMATO_PLANTA, MAX_NOME_FASE, regrasDeTexto, revisaoAberta, rotuloRevisao } from './_regras'
import type { BaseDesenho, FaseTela, RevisaoTela } from './_tipos'

const botao = 'inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-(--obra-card) px-4 text-sm font-medium text-(--obra-ink) disabled:opacity-45'
const botaoPri = 'inline-flex min-h-11 items-center rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45'
const campo = 'min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-base text-(--obra-text) disabled:bg-(--obra-surface)'

const CAMPOS_CARIMBO: { k: keyof Carimbo; rotulo: string }[] = [
  { k: 'titulo', rotulo: 'Título da prancha' },
  { k: 'cliente', rotulo: 'Cliente' },
  { k: 'desenho', rotulo: 'Desenho' },
  { k: 'base', rotulo: 'Base' },
  { k: 'rt', rotulo: 'Responsável técnico (nome · CREA)' },
]

export function AvisoSemPlanta() {
  return (
    <p role="note" className="rounded-lg border border-[#f7cb15] bg-[#fff8db] px-3 py-2 text-sm text-(--obra-yellow-texto)">
      Esta obra ainda não tem planta no Mapa: as camadas ficam sobre um quadro branco. Para usar o layout da loja como base, envie a imagem
      em Mapa → Montar o mapa.
    </p>
  )
}

export default function TelaFaseamento({
  obraId,
  obra,
  fases,
  faseId,
  revisao,
  base,
  podeEditar,
  temTrava,
}: {
  obraId: string
  /** Nome e OS da obra, para a prévia da prancha. */
  obra: { nome: string; os: string }
  fases: FaseTela[]
  faseId: string | null
  revisao: RevisaoTela | null
  base: BaseDesenho
  podeEditar: boolean
  /** A obra tem atividade-trava definida (Configurações). */
  temTrava: boolean
}) {
  const router = useRouter()
  const fase = fases.find((f) => f.id === faseId) ?? null
  const [aba, setAba] = useState<'editar' | 'prancha'>('editar')
  const [camadas, setCamadas] = useState<Camada[]>(revisao?.camadas ?? [])
  const [regrasTexto, setRegrasTexto] = useState((revisao?.regras ?? []).join('\n'))
  const [carimbo, setCarimbo] = useState<Carimbo | null>(revisao?.carimbo ?? null)
  const [usaTrava, setUsaTrava] = useState(revisao?.usaTrava ?? false)
  const [sujo, setSujo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<'emitir' | 'enviar' | null>(null)
  const [novaFase, setNovaFase] = useState<string | null>(null)
  /** Troca de fase pedida com alterações não salvas: o destino, à espera de Descartar/Voltar. */
  const [trocarPara, setTrocarPara] = useState<string | null>(null)

  const emitida = revisao?.status === 'emitida'
  const leitura = !podeEditar || !revisao || emitida || !!revisao.ilegivel
  const temRascunho = !!fase?.revisoes.some((r) => r.status === 'rascunho')
  const pdf = revisao ? `/obras/obras/${obraId}/faseamento/${revisao.id}/pdf` : null
  const regras = regrasDeTexto(regrasTexto)
  const semPlanta = !base.url

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
      setErro('Não deu para concluir. Confira a conexão e tente de novo.')
      return null
    } finally {
      setOcupado(false)
    }
  }

  /** Confere no navegador com os mesmos schemas do servidor e grava o rascunho. */
  async function salvar(okMsg = 'Rascunho salvo.'): Promise<boolean> {
    if (!revisao || !carimbo) return false
    const c = camadasSchema.safeParse(camadas)
    if (!c.success) {
      setErro(`Camadas inválidas: ${c.error.message}`)
      return false
    }
    const rg = regrasSchema.safeParse(regras)
    if (!rg.success) {
      setErro(`Regras: ${rg.error.message}`)
      return false
    }
    const cb = carimboSchema.safeParse(carimbo)
    if (!cb.success) {
      setErro(`Carimbo: ${cb.error.message}`)
      return false
    }
    const r = await rodar(() => salvarRascunhoAction(revisao.id, { camadas: c.data, regras: rg.data, carimbo: cb.data, usaTrava }), okMsg)
    if (!r) return false
    setSujo(false)
    router.refresh()
    return true
  }

  async function emitir() {
    if (!revisao) return
    setConfirmar(null)
    if (sujo && !(await salvar(''))) return
    const r = await rodar(() => emitirRevisaoAction(revisao.id), `Revisão R${revisao.revisao} emitida.`)
    if (r) router.refresh()
  }

  async function novaRevisao() {
    if (!fase) return
    const r = await rodar(() => novaRevisaoAction(fase.id), 'Nova revisão criada a partir da última emitida.')
    if (r) router.refresh()
  }

  async function enviar() {
    if (!revisao) return
    setConfirmar(null)
    const r = await rodar(() => enviarFaseamentoAction(revisao.id))
    if (r) setAviso(`Enviado a ${r.enviados ?? 0} destinatário(s). O envio está em Comunicação.`)
    router.refresh()
  }

  /** Rascunho com alterações não salvas: salva antes e só então abre o PDF (a aba nasce no clique, para não ser bloqueada). */
  async function gerarPdf() {
    if (!pdf) return
    const janela = window.open('', '_blank')
    if (!(await salvar('Rascunho salvo. Abrindo o PDF.'))) {
      janela?.close()
      return
    }
    if (janela) janela.location.href = pdf
    else window.open(pdf, '_blank', 'noopener')
  }

  async function criarFase() {
    const nome = (novaFase ?? '').trim()
    const r = await rodar(() => criarFaseAction(obraId, nome), 'Fase criada.')
    if (!r) return
    setNovaFase(null)
    router.push(`/obras/obras/${obraId}/faseamento?fase=${r.faseId}`)
    router.refresh()
  }

  const mudar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setSujo(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">Faseamento</h2>
          <p className="text-sm text-(--obra-muted-texto)">Uma prancha A3 por fase: a planta como base, as camadas, as regras e o carimbo.</p>
        </div>
        {podeEditar && novaFase === null ? (
          <button type="button" className={botao} onClick={() => setNovaFase('')}>
            + Nova fase
          </button>
        ) : null}
      </header>

      {novaFase !== null ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-(--obra-border) bg-(--obra-card) p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void criarFase()
          }}
        >
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-(--obra-muted-texto)">
            Nome da nova fase
            <input autoFocus value={novaFase} maxLength={MAX_NOME_FASE} onChange={(e) => setNovaFase(e.target.value)} placeholder="Demolição e reforço" className={campo} />
          </label>
          <button type="submit" disabled={ocupado || !novaFase.trim()} className={botaoPri}>
            Criar fase
          </button>
          <button type="button" className={botao} onClick={() => setNovaFase(null)}>
            Cancelar
          </button>
        </form>
      ) : null}

      {semPlanta ? <AvisoSemPlanta /> : null}
      {base.foraDoPdf ? (
        <p role="note" className="rounded-lg border border-[#f7cb15] bg-[#fff8db] px-3 py-2 text-sm text-(--obra-yellow-texto)">
          {AVISO_FORMATO_PLANTA}.
        </p>
      ) : null}
      {erro ? <p role="alert" className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-(--obra-vermelho-texto)">{erro}</p> : null}
      {revisao?.ilegivel ? <p role="alert" className="rounded-lg border border-[#b42318] bg-[#fdecea] px-3 py-2 text-sm text-(--obra-vermelho-texto)">{revisao.ilegivel}</p> : null}
      {aviso ? <p role="status" className="text-sm text-(--obra-verde-texto)">{aviso}</p> : null}

      {fases.length ? (
        <nav aria-label="Fases" className="flex flex-wrap gap-2">
          {fases.map((f) => {
            const r = revisaoAberta(f.revisoes)
            const atual = f.id === faseId
            return (
              <Link
                key={f.id}
                href={`/obras/obras/${obraId}/faseamento?fase=${f.id}`}
                aria-current={atual ? 'page' : undefined}
                onClick={(e) => {
                  if (!sujo || atual) return
                  e.preventDefault()
                  setTrocarPara(`/obras/obras/${obraId}/faseamento?fase=${f.id}`)
                }}
                className={`flex min-h-11 flex-col rounded-xl border px-3 py-2 text-sm ${atual ? 'border-(--obra-orange-texto) bg-(--obra-card)' : 'border-(--obra-border) bg-(--obra-card)'}`}
              >
                <b className="text-(--obra-ink)">
                  Fase {f.numero} · {f.nome}
                </b>
                <span className="obra-num text-xs text-(--obra-muted-texto)">{r ? rotuloRevisao(r) : 'sem revisão'}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}
      {trocarPara ? (
        <div role="alertdialog" aria-label="Alterações não salvas" className="flex flex-col gap-2 rounded-xl border border-(--obra-orange-texto) bg-[#fff4ec] p-3 text-sm text-(--obra-text)">
          <p>Esta revisão tem alterações não salvas. Trocar de fase descarta essas alterações.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={botaoPri}
              onClick={() => {
                const destino = trocarPara
                setTrocarPara(null)
                setSujo(false)
                router.push(destino)
              }}
            >
              Descartar alterações
            </button>
            <button type="button" className={botao} onClick={() => setTrocarPara(null)}>
              Voltar
            </button>
          </div>
        </div>
      ) : null}
      {fases.length ? null : (
        <p className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-sm text-(--obra-muted-texto)">
          Nenhuma fase ainda.{podeEditar ? ' Use "+ Nova fase" para começar.' : ' Quem cria é o engenheiro da obra, o coordenador ou um administrador.'}
        </p>
      )}

      {fase && revisao && carimbo ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Visão" className="hidden flex-wrap gap-1 md:flex">
              {(
                [
                  ['editar', 'Editar camadas'],
                  ['prancha', 'Prancha A3'],
                ] as const
              ).map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={aba === v}
                  onClick={() => setAba(v)}
                  className={`min-h-11 rounded-lg border px-3 text-sm ${aba === v ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="revisao-atual" className="obra-num rounded-full border border-(--obra-border) px-3 py-1 text-xs font-semibold text-(--obra-ink)">
                Revisão R{revisao.revisao} · {emitida ? 'emitida' : 'rascunho'}
                {sujo ? ' · alterações não salvas' : ''}
              </span>
              {!leitura ? (
                <span className="hidden flex-wrap gap-2 md:flex">
                  <button type="button" disabled={ocupado || !sujo} className={botao} onClick={() => void salvar()}>
                    Salvar rascunho
                  </button>
                  <button type="button" disabled={ocupado} className={botaoPri} onClick={() => setConfirmar('emitir')}>
                    Emitir revisão
                  </button>
                </span>
              ) : null}
              {podeEditar && emitida && !temRascunho ? (
                <button type="button" disabled={ocupado} className={`${botao} hidden md:inline-flex`} onClick={() => void novaRevisao()}>
                  Nova revisão
                </button>
              ) : null}
              {pdf && sujo && !leitura ? (
                // Alterações não salvas: o PDF sai do salvo, então salva antes de abrir.
                <button type="button" disabled={ocupado} className={botao} onClick={() => void gerarPdf()}>
                  Gerar PDF
                </button>
              ) : pdf ? (
                <a href={pdf} target="_blank" rel="noopener" className={botao}>
                  Gerar PDF
                </a>
              ) : null}
              {podeEditar && emitida ? (
                <button type="button" disabled={ocupado} className={`${botaoPri} hidden md:inline-flex`} onClick={() => setConfirmar('enviar')}>
                  Enviar ao cliente
                </button>
              ) : null}
            </div>
          </div>

          {confirmar ? (
            <div role="alertdialog" aria-label={confirmar === 'emitir' ? 'Confirmar emissão' : 'Confirmar envio'} className="flex flex-col gap-2 rounded-xl border border-(--obra-orange-texto) bg-[#fff4ec] p-3 text-sm text-(--obra-text)">
              <p>
                {confirmar === 'emitir'
                  ? `Emitir a revisão R${revisao.revisao}? Depois de emitida ela não muda mais (camadas, regras, carimbo, base e o status da trava ficam congelados). Para alterar, crie uma nova revisão.${sujo ? ' As alterações não salvas serão salvas antes.' : ''}`
                  : `Enviar a prancha R${revisao.revisao} por e-mail aos destinatários do relatório de fase (Semanal ou Mensal, em Configurações da obra)? O envio fica registrado em Comunicação.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={ocupado} className={botaoPri} onClick={() => void (confirmar === 'emitir' ? emitir() : enviar())}>
                  {confirmar === 'emitir' ? 'Confirmar emissão' : 'Confirmar envio'}
                </button>
                <button type="button" className={botao} onClick={() => setConfirmar(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {emitida ? (
            <p className="text-sm text-(--obra-muted-texto)">
              Revisão emitida{revisao.emitidaEm ? ` em ${new Date(revisao.emitidaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : ''}
              {revisao.emitidaPor ? ` por ${revisao.emitidaPor}` : ''}: tudo em leitura.
              {podeEditar && temRascunho ? ' Já existe uma revisão em rascunho para esta fase.' : ''}
            </p>
          ) : !podeEditar ? (
            <p className="text-sm text-(--obra-muted-texto)">Só o engenheiro da obra, o coordenador ou um administrador edita: você vê em leitura.</p>
          ) : null}
          {revisao.travaTexto ? <p className="rounded-lg border border-[#b42318] px-3 py-2 text-sm text-[#b42318]">{revisao.travaTexto}</p> : null}

          {/* Celular: só a prévia e o PDF. */}
          <div className="flex flex-col gap-2 md:hidden">
            <div className="overflow-hidden rounded-xl border border-(--obra-border) bg-(--obra-card)">
              <DesenhoFase camadas={camadas} base={base} />
            </div>
            <p className="text-xs text-(--obra-muted-texto)">O editor de camadas abre em tela a partir de 768 px (tablet ou computador).</p>
          </div>

          {/* Tela ≥ 768 px: editor e prancha. */}
          <div className="hidden md:block">
            {aba === 'editar' ? (
              <EditorCamadas camadas={camadas} onChange={mudar(setCamadas)} base={base} somenteLeitura={leitura} />
            ) : (
              <section className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  {CAMPOS_CARIMBO.map(({ k, rotulo }) => (
                    <label key={k} className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
                      {rotulo}
                      <input value={carimbo[k]} maxLength={300} disabled={leitura} onChange={(e) => mudar(setCarimbo)({ ...carimbo, [k]: e.target.value })} className={campo} />
                    </label>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
                  Regras impressas (uma por linha; até {MAX_REGRAS}, cada uma com até {MAX_TEXTO_REGRA} caracteres)
                  <textarea value={regrasTexto} rows={7} disabled={leitura} onChange={(e) => mudar(setRegrasTexto)(e.target.value)} className={`${campo} py-2`} />
                  <span className={regras.length > MAX_REGRAS || regras.some((r) => r.length > MAX_TEXTO_REGRA) ? 'text-(--obra-vermelho-texto)' : ''}>
                    {regras.length} de {MAX_REGRAS} regras
                  </span>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-(--obra-text)">
                  <input type="checkbox" className="size-5" checked={usaTrava} disabled={leitura || (!temTrava && !usaTrava)} onChange={(e) => mudar(setUsaTrava)(e.target.checked)} />
                  Usar a trava estrutural (imprime o status da atividade-trava e das bloqueadas no dia da emissão)
                </label>
                {!temTrava ? <p className="text-xs text-(--obra-muted-texto)">A obra não tem atividade-trava definida em Configurações.</p> : null}
                <PreviaPrancha
                  obra={obra}
                  fase={{ numero: fase.numero, nome: fase.nome }}
                  revisao={revisao.revisao}
                  emitidaEm={revisao.emitidaEm}
                  camadas={camadas}
                  regras={regras}
                  carimbo={carimbo}
                  travaTexto={revisao.travaTexto ?? (usaTrava ? 'Regra de trava ligada: o status da atividade-trava é gravado na emissão.' : null)}
                  base={base}
                />
                <p className="text-xs text-(--obra-muted-texto)">
                  Prévia aproximada da folha A3 paisagem (420 × 297 mm), com o que está na tela. O PDF sai sempre do que está salvo
                  {leitura ? '' : ': com alterações pendentes, "Gerar PDF" salva o rascunho antes de abrir'}.
                </p>
              </section>
            )}
          </div>

          {fase.revisoes.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-(--obra-muted-texto)">
              Revisões desta fase:
              {[...fase.revisoes]
                .sort((a, b) => a.revisao - b.revisao)
                .map((r) => (
                  <a key={r.id} href={`/obras/obras/${obraId}/faseamento/${r.id}/pdf`} target="_blank" rel="noopener" className="obra-num inline-flex min-h-11 items-center underline">
                    {rotuloRevisao(r)}
                  </a>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
