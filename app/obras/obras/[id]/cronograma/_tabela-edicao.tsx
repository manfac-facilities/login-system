'use client'

/**
 * Visão Tabela do cronograma (Leva 1b, itens 1, 2 e 15): planilha para montar
 * e ajustar o rascunho — etapa, atividade, dias úteis, início, fim,
 * predecessoras e trava editados célula a célula (Tab vai para a próxima
 * célula, Enter grava e desce, Shift+Enter sobe, Esc desfaz), e a estrutura
 * (+ Etapa, renomear, ↑/↓, + Atividade, excluir).
 *
 * O código exibido "etapa.posição" (1.2) é calculado da ordem de exibição;
 * o que se grava é sempre o `numero` (identidade ligada à execução).
 */
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconeAlerta, IconeCadeado } from '../../_ui/icones'
import { dataBR } from './_arvore'
import type { Direcao, EdicaoLinha, LinhaAtividade, LinhaEtapa } from './_tipos'

/** Cada ação devolve `true` se gravou (a tela mostra o erro quando não). */
export type AcoesTabela = {
  salvar: (edicao: EdicaoLinha) => Promise<boolean>
  inicio: (numero: number, iso: string | null) => Promise<boolean>
  fim: (numero: number, iso: string) => Promise<boolean>
  adicionarEtapa: (nome: string) => Promise<boolean>
  renomearEtapa: (atual: string, novo: string) => Promise<boolean>
  moverEtapa: (nome: string, direcao: Direcao) => Promise<boolean>
  adicionarAtividade: (etapa: string) => Promise<boolean>
  moverAtividade: (numero: number, direcao: Direcao) => Promise<boolean>
  excluirAtividade: (numero: number) => Promise<boolean>
}

/** numero → "etapa.posição" (1-based), na ordem de exibição. */
export function codigosDe(etapas: LinhaEtapa[]): Map<number, string> {
  const m = new Map<number, string>()
  etapas.forEach((e, i) => e.numeros.forEach((n, j) => m.set(n, `${i + 1}.${j + 1}`)))
  return m
}

/** Valor (R$) como a célula mostra: 1.234,56. */
export const valorBR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moedaBR = (v: number) => 'R$ ' + valorBR(v)
/** "R$ 1.234,56" / "1234,5" / "1234.5" → número; vazio = 0; inválido = NaN (o servidor recusa). */
export function lerValor(texto: string): number {
  let t = texto.replace(/R\$|\s/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

type Coluna = 'etapa' | 'descricao' | 'duracao' | 'valor' | 'inicio' | 'fim' | 'pred1' | 'pred2' | 'trava'

/** Enter/Shift+Enter: mesma coluna na linha de baixo/de cima. */
function moverFoco(de: HTMLElement, passo: number) {
  const linha = Number(de.dataset.linha)
  const alvo = de
    .closest('table')
    ?.querySelector<HTMLElement>(`[data-linha="${linha + passo}"][data-col="${de.dataset.col}"]`)
  alvo?.focus()
  if (alvo instanceof HTMLInputElement && alvo.type === 'text') alvo.select()
}

const CAMPO =
  'h-9 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] text-(--obra-text) hover:border-(--obra-border) focus:border-(--obra-ink) focus:bg-white'

/**
 * Campo que grava ao sair (blur) ou com Enter, só se mudou. Valor novo vindo do
 * servidor substitui o da tela enquanto o usuário não estiver digitando nele.
 */
function Campo({
  valor,
  rotulo,
  tipo,
  linha,
  col,
  numero,
  onSalvar,
  className = '',
  placeholder,
  modo,
}: {
  valor: string
  rotulo: string
  placeholder?: string
  /** inputMode para texto (ex.: 'decimal' no valor). */
  modo?: 'decimal'
  tipo: 'text' | 'number' | 'date'
  linha: number
  col: Coluna | 'etapa-nome'
  numero?: number
  onSalvar: (v: string) => Promise<boolean>
  className?: string
}) {
  const [prev, setPrev] = useState(valor)
  const [texto, setTexto] = useState(valor)
  const [sujo, setSujo] = useState(false)
  const sujoRef = useRef(false)
  if (valor !== prev) {
    setPrev(valor)
    if (!sujo) setTexto(valor)
  }
  const limpar = () => {
    sujoRef.current = false
    setSujo(false)
  }
  const confirmar = async () => {
    if (!sujoRef.current) return
    limpar()
    if (texto === valor || (tipo !== 'text' && texto === '')) {
      setTexto(valor)
      return
    }
    if (!(await onSalvar(texto))) setTexto(valor)
  }
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void confirmar()
      moverFoco(e.currentTarget, e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      limpar()
      setTexto(valor)
    }
  }
  return (
    <input
      aria-label={rotulo}
      title={rotulo}
      type={tipo}
      inputMode={tipo === 'number' ? 'numeric' : modo}
      min={tipo === 'number' ? 1 : undefined}
      data-linha={linha}
      data-col={col}
      data-numero={numero}
      className={CAMPO + (tipo === 'text' ? '' : ' obra-num') + ' ' + className}
      placeholder={placeholder}
      value={texto}
      onChange={(e) => {
        sujoRef.current = true
        setSujo(true)
        setTexto(e.target.value)
      }}
      onKeyDown={tecla}
      onBlur={() => void confirmar()}
    />
  )
}

/**
 * Lista (Etapa, Pred. 1, Pred. 2). Escolha com o mouse grava na hora; pelo teclado
 * (setas/letras numa lista fechada disparam `change` a cada passo no Windows) só
 * grava ao sair (blur/Tab) ou com Enter — senão cada passo moveria a atividade de
 * etapa ou gravaria predecessoras intermediárias. Esc desfaz.
 */
function Lista({
  valor,
  rotulo,
  linha,
  col,
  opcoes,
  onSalvar,
  className = '',
}: {
  valor: string
  rotulo: string
  linha: number
  col: Coluna
  opcoes: { valor: string; rotulo: string }[]
  onSalvar: (v: string) => Promise<boolean>
  className?: string
}) {
  const [prev, setPrev] = useState(valor)
  const [sel, setSel] = useState(valor)
  const [sujo, setSujo] = useState(false)
  const pendente = useRef<string | null>(null)
  const teclado = useRef(false)
  if (valor !== prev) {
    setPrev(valor)
    if (!sujo) setSel(valor)
  }
  const confirmar = async () => {
    const v = pendente.current
    if (v === null) return
    pendente.current = null
    setSujo(false)
    if (v === valor) return
    if (!(await onSalvar(v))) setSel(valor)
  }
  return (
    <select
      aria-label={rotulo}
      title={opcoes.find((o) => o.valor === sel)?.rotulo ?? rotulo}
      data-linha={linha}
      data-col={col}
      className={CAMPO + ' ' + className}
      value={sel}
      onPointerDown={() => {
        teclado.current = false
      }}
      onChange={(e) => {
        setSel(e.target.value)
        pendente.current = e.target.value
        setSujo(true)
        if (!teclado.current) void confirmar()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void confirmar()
          moverFoco(e.currentTarget, e.shiftKey ? -1 : 1)
        } else if (e.key === 'Escape') {
          pendente.current = null
          setSujo(false)
          setSel(valor)
        } else if (e.key !== 'Tab') {
          teclado.current = true
        }
      }}
      onBlur={() => {
        teclado.current = false
        void confirmar()
      }}
    >
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  )
}

const BOTAO_ICONE =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-(--obra-ink) hover:bg-(--obra-surface) disabled:opacity-30'
const BOTAO =
  'inline-flex min-h-9 items-center gap-1 rounded-md border border-(--obra-border) bg-(--obra-card) px-2.5 text-[12px] font-medium text-(--obra-ink) hover:bg-(--obra-surface) disabled:opacity-50'

function Seta({ cima }: { cima: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {cima ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  )
}
function Lixeira() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}

export default function TabelaEdicao({
  etapas,
  atividades,
  editavel,
  acoes,
  focarNumero,
  onFocado,
  valores = null,
}: {
  etapas: LinhaEtapa[]
  atividades: LinhaAtividade[]
  editavel: boolean
  acoes: AcoesTabela
  /** Atividade recém-criada: o foco vai para a descrição dela quando aparecer. */
  focarNumero?: number | null
  /** Valor (R$) por numero; só no rascunho editável. null = sem a coluna. */
  valores?: Record<number, number> | null
  onFocado?: () => void
}) {
  const porNumero = new Map(atividades.map((a) => [a.numero, a]))
  const codigos = codigosDe(etapas)
  const ordem = etapas.flatMap((e) => e.numeros)
  // Índice da linha de atividade na tabela (Enter desce para a mesma coluna na próxima).
  const indice = new Map(ordem.map((n, i) => [n, i]))
  const comValor = !!valores
  const valorDe = (n: number) => valores?.[n] ?? 0
  const extra = comValor ? 1 : 0
  const opcoesEtapa = etapas.map((e) => ({ valor: e.chave, rotulo: e.nome }))
  const opcoesPred = (self: number) => [
    { valor: '', rotulo: '—' },
    ...ordem
      .filter((n) => n !== self)
      .map((n) => ({ valor: String(n), rotulo: `${codigos.get(n)} – ${porNumero.get(n)?.descricao ?? ''}` })),
  ]
  const tabelaRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    if (!focarNumero) return
    const el = tabelaRef.current?.querySelector<HTMLInputElement>(`[data-numero="${focarNumero}"][data-col="descricao"]`)
    if (!el) return
    el.focus()
    el.select()
    onFocado?.()
  }, [focarNumero, atividades, onFocado])

  const th =
    'sticky top-0 z-10 h-10 bg-(--obra-surface) px-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-(--obra-muted-texto) whitespace-nowrap shadow-[inset_0_-1px_0_var(--obra-border)]'
  const td = 'h-11 px-1 align-middle whitespace-nowrap shadow-[inset_0_-1px_0_var(--obra-border)]'

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl border border-(--obra-border) bg-(--obra-card)">
        <table ref={tabelaRef} className="w-full border-separate border-spacing-0 text-[13px] text-(--obra-text)">
          <thead>
            <tr>
              <th className={th} scope="col">Código</th>
              <th className={th} scope="col">Etapa</th>
              <th className={th + ' min-w-56'} scope="col">Atividade</th>
              <th className={th} scope="col">Dias úteis</th>
              {comValor ? <th className={th} scope="col" title="Pesa o avanço físico. Interno: não aparece para o cliente.">Valor (R$)</th> : null}
              <th className={th} scope="col">Início</th>
              <th className={th} scope="col">Fim</th>
              <th className={th} scope="col">Pred. 1</th>
              <th className={th} scope="col">Pred. 2</th>
              <th className={th} scope="col">
                <span className="sr-only">Trava</span>
                <IconeCadeado tamanho={13} />
              </th>
              {editavel ? <th className={th + ' right-0 z-20'} scope="col"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {etapas.map((e, ei) => (
              <Fragment key={'e:' + e.chave}>
                <tr className="bg-[#eef2f5] font-semibold text-(--obra-ink)">
                  <td className={td + ' obra-num pl-3'}>{ei + 1}</td>
                  <td className={td} colSpan={(editavel ? 9 : 8) + extra}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.cor }} />
                      {editavel ? (
                        <Campo
                          valor={e.chave}
                          rotulo={`Nome da etapa ${ei + 1}`}
                          tipo="text"
                          linha={-100 - ei}
                          col="etapa-nome"
                          placeholder="Sem etapa — dê um nome"
                          className="w-72 font-semibold placeholder:font-normal"
                          onSalvar={(v) => acoes.renomearEtapa(e.chave, v)}
                        />
                      ) : (
                        <span>{e.nome}</span>
                      )}
                      <span className="text-[12px] font-normal text-(--obra-muted-texto)">
                        ({e.numeros.length} {e.numeros.length === 1 ? 'atividade' : 'atividades'})
                      </span>
                      {comValor ? (
                        <span className="obra-num text-[12px] font-normal text-(--obra-muted-texto)" aria-label={`Subtotal da etapa ${ei + 1}`}>
                          Subtotal {moedaBR(e.numeros.reduce((s, n) => s + valorDe(n), 0))}
                        </span>
                      ) : null}
                      {editavel ? (
                        <span className="flex items-center gap-1 font-normal">
                          <button type="button" className={BOTAO_ICONE} aria-label={`Subir etapa ${e.nome}`} title="Subir etapa" disabled={ei === 0} onClick={() => acoes.moverEtapa(e.chave, 'cima')}>
                            <Seta cima />
                          </button>
                          <button type="button" className={BOTAO_ICONE} aria-label={`Descer etapa ${e.nome}`} title="Descer etapa" disabled={ei === etapas.length - 1} onClick={() => acoes.moverEtapa(e.chave, 'baixo')}>
                            <Seta cima={false} />
                          </button>
                          <button type="button" className={BOTAO} onClick={() => acoes.adicionarAtividade(e.chave)} aria-label={`Adicionar atividade na etapa ${e.nome}`}>
                            + Atividade
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {e.numeros.map((n, ai) => {
                  const a = porNumero.get(n)!
                  const linha = indice.get(n)!
                  const cod = codigos.get(n)!
                  return (
                    <tr key={n} className="bg-(--obra-card)">
                      <td className={td + ' obra-num pl-3 text-(--obra-muted-texto)'} title={`Atividade nº ${n}`}>
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden="true" className="h-4 w-0.5 rounded-full" style={{ backgroundColor: e.cor }} />
                          {cod}
                        </span>
                      </td>
                      <Celula editavel={editavel} texto={e.nome}>
                        <Lista
                          valor={a.etapa}
                          rotulo={`Etapa da atividade ${cod}`}
                          linha={linha}
                          col="etapa"
                          opcoes={opcoesEtapa}
                          className="w-32"
                          onSalvar={(v) => acoes.salvar({ numero: n, etapa: v })}
                        />
                      </Celula>
                      <Celula editavel={editavel} texto={a.descricao}>
                        <Campo
                          valor={a.descricao}
                          rotulo={`Atividade ${cod}`}
                          tipo="text"
                          linha={linha}
                          col="descricao"
                          numero={n}
                          className="w-full min-w-56"
                          onSalvar={(v) => acoes.salvar({ numero: n, descricao: v })}
                        />
                      </Celula>
                      <Celula editavel={editavel} texto={String(a.duracao)} num>
                        <Campo
                          valor={String(a.duracao)}
                          rotulo={`Dias úteis da atividade ${cod}`}
                          tipo="number"
                          linha={linha}
                          col="duracao"
                          className="w-16"
                          onSalvar={(v) => acoes.salvar({ numero: n, duracao: Number(v) })}
                        />
                      </Celula>
                      {comValor ? (
                        <td className={td}>
                          <Campo
                            valor={valorBR(valorDe(n))}
                            rotulo={`Valor (R$) da atividade ${cod}`}
                            tipo="text"
                            modo="decimal"
                            linha={linha}
                            col="valor"
                            className="obra-num w-28 text-right"
                            onSalvar={(v) => acoes.salvar({ numero: n, pesoValor: lerValor(v) })}
                          />
                        </td>
                      ) : null}
                      <td className={td}>
                        <span className="flex items-center gap-1">
                          {editavel ? (
                            <Campo
                              valor={a.inicioFixo ?? a.inicioPrevisto}
                              rotulo={`Início da atividade ${cod}`}
                              tipo="date"
                              linha={linha}
                              col="inicio"
                              className="w-[8rem]"
                              onSalvar={(v) => acoes.inicio(n, v)}
                            />
                          ) : (
                            <span className="obra-num px-1.5">{dataBR(a.inicioPrevisto)}</span>
                          )}
                          {a.inicioFixo ? (
                            editavel ? (
                              <button
                                type="button"
                                className="rounded border border-(--obra-border) px-1 text-[10px] font-semibold uppercase text-(--obra-ink) hover:bg-(--obra-surface)"
                                title="Início fixo — clique para seguir as predecessoras"
                                aria-label={`Atividade ${cod}: seguir predecessoras (tirar início fixo)`}
                                onClick={() => acoes.inicio(n, null)}
                              >
                                fixo ×
                              </button>
                            ) : (
                              <span className="rounded border border-(--obra-border) px-1 text-[10px] font-semibold uppercase text-(--obra-ink)">fixo</span>
                            )
                          ) : null}
                          {a.alertaInicioFixo || a.inicioFixoAjustado ? (
                            <span className="text-(--obra-yellow-texto)" title={a.alertaInicioFixo ?? 'Caiu em folga — foi para o próximo dia útil'}>
                              <IconeAlerta tamanho={13} />
                              <span className="sr-only">{a.alertaInicioFixo ?? 'Caiu em folga — foi para o próximo dia útil'}</span>
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <Celula editavel={editavel} texto={dataBR(a.fimPrevisto)} num>
                        <Campo
                          valor={a.fimPrevisto}
                          rotulo={`Fim da atividade ${cod}`}
                          tipo="date"
                          linha={linha}
                          col="fim"
                          className="w-[8rem]"
                          onSalvar={(v) => acoes.fim(n, v)}
                        />
                      </Celula>
                      {(['pred1', 'pred2'] as const).map((k) => (
                        <Celula key={k} editavel={editavel} texto={a[k] ? codigos.get(a[k]!) ?? String(a[k]) : '—'} num>
                          <Lista
                            valor={a[k] ? String(a[k]) : ''}
                            rotulo={`${k === 'pred1' ? 'Predecessora 1' : 'Predecessora 2'} da atividade ${cod}`}
                            linha={linha}
                            col={k}
                            opcoes={opcoesPred(n)}
                            className="obra-num w-32"
                            onSalvar={(v) => acoes.salvar({ numero: n, [k]: v ? Number(v) : null })}
                          />
                        </Celula>
                      ))}
                      <td className={td}>
                        <label className="flex h-9 w-9 cursor-pointer items-center justify-center" title="Bloqueia pela atividade-trava">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-(--obra-ink)"
                            checked={a.bloqueiaPorTrava}
                            disabled={!editavel}
                            data-linha={linha}
                            data-col="trava"
                            onChange={(ev) => acoes.salvar({ numero: n, bloqueiaPorTrava: ev.target.checked })}
                            aria-label={`Atividade ${cod} bloqueia pela trava`}
                          />
                        </label>
                      </td>
                      {editavel ? (
                        // Fixa à direita: ↑/↓/Excluir sempre à vista mesmo com a tabela rolando para o lado.
                        <td className={td + ' sticky right-0 z-[1] bg-(--obra-card) shadow-[inset_1px_-1px_0_var(--obra-border)]'}>
                          <span className="flex items-center">
                            <button type="button" className={BOTAO_ICONE} aria-label={`Subir atividade ${cod}`} title="Subir" disabled={ai === 0} onClick={() => acoes.moverAtividade(n, 'cima')}>
                              <Seta cima />
                            </button>
                            <button type="button" className={BOTAO_ICONE} aria-label={`Descer atividade ${cod}`} title="Descer" disabled={ai === e.numeros.length - 1} onClick={() => acoes.moverAtividade(n, 'baixo')}>
                              <Seta cima={false} />
                            </button>
                            <button
                              type="button"
                              className={BOTAO_ICONE + ' text-(--obra-vermelho-texto)'}
                              aria-label={`Excluir atividade ${cod}`}
                              title="Excluir"
                              onClick={() => {
                                if (window.confirm(`Excluir a atividade ${cod} – ${a.descricao}?`)) void acoes.excluirAtividade(n)
                              }}
                            >
                              <Lixeira />
                            </button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            {!etapas.length ? (
              <tr>
                <td colSpan={(editavel ? 10 : 9) + extra} className="px-4 py-10 text-center text-[14px] text-(--obra-muted-texto)">
                  {editavel ? 'Cronograma vazio. Comece por “+ Etapa” abaixo; cada etapa nasce com uma atividade.' : 'Sem atividades.'}
                </td>
              </tr>
            ) : null}
          </tbody>
          {comValor && etapas.length ? (
            <tfoot>
              <tr className="font-semibold text-(--obra-ink)">
                <td colSpan={4} className={td + ' bg-(--obra-surface) px-2 text-right'}>Total</td>
                <td className={td + ' obra-num bg-(--obra-surface) px-2 text-right'} aria-label="Total do valor">
                  {moedaBR(ordem.reduce((s, n) => s + valorDe(n), 0))}
                </td>
                <td colSpan={editavel ? 6 : 5} className={td + ' bg-(--obra-surface)'} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {editavel ? <NovaEtapa onAdicionar={acoes.adicionarEtapa} /> : null}
    </div>
  )
}

function Celula({ editavel, texto, num, children }: { editavel: boolean; texto: string; num?: boolean; children: ReactNode }) {
  const td = 'h-11 px-1 align-middle whitespace-nowrap shadow-[inset_0_-1px_0_var(--obra-border)]'
  return <td className={td}>{editavel ? children : <span className={'px-1.5 ' + (num ? 'obra-num' : '')}>{texto}</span>}</td>
}

function NovaEtapa({ onAdicionar }: { onAdicionar: (nome: string) => Promise<boolean> }) {
  const [nome, setNome] = useState('')
  const adicionar = async () => {
    if (!nome.trim()) return
    if (await onAdicionar(nome)) setNome('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="min-h-11 w-72 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-[13px] text-(--obra-text) placeholder:text-(--obra-muted-texto)"
        placeholder="Nome da nova etapa"
        aria-label="Nome da nova etapa"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void adicionar()
          }
        }}
      />
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--obra-ink) bg-(--obra-card) px-3.5 text-[13px] font-semibold text-(--obra-ink) hover:bg-[#e6eef5] disabled:opacity-50"
        disabled={!nome.trim()}
        onClick={() => void adicionar()}
      >
        + Etapa
      </button>
    </div>
  )
}
