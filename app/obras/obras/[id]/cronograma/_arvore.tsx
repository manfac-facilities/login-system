'use client'

/**
 * Árvore do cronograma (spec §5, estilo MS Project / Builderpad): linha de
 * etapa (resumo) com chevron e bolinha de cor; atividades abaixo. Início, Fim,
 * Dias úteis, Atividade, Predecessoras e trava editam inline só em rascunho.
 *
 * Toda linha tem a mesma altura (`ALTURA_LINHA`) para casar com o Gantt ao lado.
 */
import { useState, type KeyboardEvent, type ReactNode, type Ref, type UIEvent } from 'react'
import AnelProgresso from '../../_ui/anel-progresso'
import PilulaSituacao from '../../_ui/pilula-situacao'
import { IconeAlerta, IconeCadeado } from '../../_ui/icones'
import { Chevron } from './_barra-ferramentas'
import type { LinhaAtividade, LinhaEtapa } from './_tipos'

export const ALTURA_LINHA = 44
export const ALTURA_CABECALHO = 48

export type LinhaVisivel =
  | { tipo: 'etapa'; etapa: LinhaEtapa; aberta: boolean }
  | { tipo: 'atividade'; atividade: LinhaAtividade; cor: string }

export type Edicoes = {
  descricao: (numero: number, valor: string) => void
  duracao: (numero: number, valor: number) => void
  inicio: (numero: number, iso: string | null) => void
  fim: (numero: number, iso: string) => void
  /** `null` = texto inválido (a tela avisa). */
  predecessoras: (numero: number, preds: [number | null, number | null] | null) => void
  trava: (numero: number, valor: boolean) => void
}

export const dataBR = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const pct = (f: number) => `${Math.round(f * 100)}%`

/** "+5" (atraso), "−2" (adiantado), "—" (igual ou sem base). */
export function Delta({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-(--obra-muted-texto)">—</span>
  if (dias === 0) return <span className="text-(--obra-muted-texto)" aria-label="sem desvio">—</span>
  const atraso = dias > 0
  return (
    <span
      className={
        'obra-num font-semibold ' +
        (atraso ? 'delta-atraso text-(--obra-vermelho-texto)' : 'delta-adiantado text-(--obra-verde-texto)')
      }
      aria-label={atraso ? `${dias} dias úteis de atraso vs base` : `${-dias} dias úteis adiantado vs base`}
    >
      {atraso ? `+${dias}` : `−${-dias}`}
    </span>
  )
}

/** Converte "3, 5" em [3, 5]; vazio → [null, null]; inválido → null. */
export function lerPredecessoras(texto: string): [number | null, number | null] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean)
  if (partes.length > 2) return null
  const nums = partes.map(Number)
  if (nums.some((n) => !Number.isInteger(n) || n < 1)) return null
  return [nums[0] ?? null, nums[1] ?? null]
}

// Linha divisória por sombra (não ocupa altura): a linha mede exatamente ALTURA_LINHA.
const CELULA = 'h-11 px-2 align-middle whitespace-nowrap shadow-[inset_0_-1px_0_var(--obra-border)]'
const NUM = 'obra-num text-[13px]'
const SO_MD = ' hidden md:table-cell'

/** Célula que vira campo ao clicar (rascunho) ou texto puro (versão salva). */
function Editavel({
  editavel,
  rotulo,
  exibir,
  inicial,
  tipo,
  onSalvar,
  extra,
  className = '',
}: {
  editavel: boolean
  rotulo: string
  exibir: ReactNode
  inicial: string
  tipo: 'text' | 'date' | 'number'
  onSalvar: (valor: string) => void
  extra?: (fechar: () => void) => ReactNode
  className?: string
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(inicial)
  if (!editavel) return <span className={className}>{exibir}</span>
  if (!editando) {
    return (
      <button
        type="button"
        aria-label={rotulo}
        title={rotulo}
        className={
          'flex min-h-9 w-full items-center gap-1 rounded-md px-1 text-left hover:bg-(--obra-surface) hover:ring-1 hover:ring-(--obra-border) ' +
          className
        }
        onClick={() => {
          setValor(inicial)
          setEditando(true)
        }}
      >
        {exibir}
      </button>
    )
  }
  const fechar = () => setEditando(false)
  const confirmar = () => {
    fechar()
    if (valor !== inicial) onSalvar(valor)
  }
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') confirmar()
    if (e.key === 'Escape') fechar()
  }
  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        aria-label={rotulo}
        type={tipo}
        inputMode={tipo === 'number' ? 'numeric' : undefined}
        min={tipo === 'number' ? 1 : undefined}
        className={
          'h-9 rounded-md border border-(--obra-ink) bg-white px-1.5 text-[13px] text-(--obra-text) ' +
          (tipo === 'text' ? 'w-full min-w-40' : tipo === 'number' ? 'w-16 obra-num' : 'w-[8.5rem] obra-num')
        }
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={tecla}
        onBlur={confirmar}
      />
      {extra?.(fechar)}
    </span>
  )
}

export default function Arvore({
  linhas,
  editavel,
  pendente,
  onAlternar,
  edicoes,
  foco,
  onFoco,
  rolagemRef,
  onRolar,
}: {
  linhas: LinhaVisivel[]
  editavel: boolean
  pendente: boolean
  onAlternar: (chave: string) => void
  edicoes: Edicoes
  foco: string | null
  onFoco: (chave: string | null) => void
  rolagemRef?: Ref<HTMLDivElement>
  onRolar?: (e: UIEvent<HTMLDivElement>) => void
}) {
  const th = 'sticky top-0 z-10 h-12 bg-(--obra-surface) shadow-[inset_0_-1px_0_var(--obra-border)] px-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-(--obra-muted-texto) whitespace-nowrap'
  return (
    <div
      ref={rolagemRef}
      onScroll={onRolar}
      onMouseLeave={() => onFoco(null)}
      className="relative h-full overflow-x-auto lg:overflow-y-auto"
      aria-busy={pendente}
    >
      <table className="w-full border-separate border-spacing-0 text-[13px] text-(--obra-text)">
        <thead>
          <tr>
            <th className={th + ' left-0 z-20 w-14'} scope="col">
              Nº
            </th>
            <th className={th + ' min-w-44 md:left-14 md:z-20 md:min-w-48'} scope="col">
              Atividade
            </th>
            <th className={th} scope="col">Situação</th>
            <th className={th} scope="col">%</th>
            <th className={th + SO_MD} scope="col">Dias úteis</th>
            <th className={th} scope="col">Início</th>
            <th className={th} scope="col">Fim</th>
            <th className={th + SO_MD} scope="col">Início base</th>
            <th className={th + SO_MD} scope="col">Fim base</th>
            <th className={th} scope="col" title="Dias úteis do fim projetado vs a base">Δ dias</th>
            <th className={th + SO_MD} scope="col">Predecessoras</th>
            {editavel ? <th className={th} scope="col"><span className="sr-only">Trava</span><IconeCadeado tamanho={13} /></th> : null}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) =>
            l.tipo === 'etapa' ? (
              <LinhaDeEtapa key={'e:' + l.etapa.chave} l={l} editavel={editavel} onAlternar={onAlternar} foco={foco} onFoco={onFoco} />
            ) : (
              <LinhaDeAtividade
                key={l.atividade.numero}
                a={l.atividade}
                cor={l.cor}
                editavel={editavel && !pendente}
                comColunaTrava={editavel}
                edicoes={edicoes}
                focada={foco === 'a:' + l.atividade.numero}
                onFoco={onFoco}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function LinhaDeEtapa({
  l,
  editavel,
  onAlternar,
  foco,
  onFoco,
}: {
  l: Extract<LinhaVisivel, { tipo: 'etapa' }>
  editavel: boolean
  onAlternar: (chave: string) => void
  foco: string | null
  onFoco: (chave: string | null) => void
}) {
  const e = l.etapa
  const chave = 'e:' + e.chave
  const fundo = foco === chave ? 'bg-[#e3ebf2]' : 'bg-[#eef2f5]'
  return (
    <tr
      className="font-semibold text-(--obra-ink)"
      onMouseEnter={() => onFoco(chave)}
      onFocusCapture={() => onFoco(chave)}
    >
      <td className={CELULA + ' sticky left-0 z-[1] w-14 ' + fundo}>
        <button
          type="button"
          aria-expanded={l.aberta}
          aria-label={(l.aberta ? 'Recolher' : 'Expandir') + ' etapa ' + e.nome}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/70"
          onClick={() => onAlternar(e.chave)}
        >
          <Chevron aberto={l.aberta} tamanho={16} />
        </button>
      </td>
      <td className={CELULA + ' max-w-48 md:sticky md:left-14 md:z-[1] md:max-w-72 ' + fundo}>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-2 text-left"
          tabIndex={-1}
          onClick={() => onAlternar(e.chave)}
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.cor }} />
          <span className="truncate">{e.nome}</span>
          <span className="shrink-0 text-[12px] font-normal text-(--obra-muted-texto)">({e.numeros.length})</span>
        </button>
        <BarraMovel percentual={e.percentual} />
      </td>
      <td className={CELULA + ' ' + fundo + ' font-normal'}>
        <PilulaSituacao situacao={e.situacao} status={e.status} />
      </td>
      <td className={CELULA + ' ' + fundo}>
        <Percentual valor={e.percentual} />
      </td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo + SO_MD}>{e.diasUteis}</td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo}>{dataBR(e.inicio)}</td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo}>{dataBR(e.fim)}</td>
      <td className={CELULA + ' ' + NUM + ' font-normal text-(--obra-muted-texto) ' + fundo + SO_MD}>{dataBR(e.inicioBase)}</td>
      <td className={CELULA + ' ' + NUM + ' font-normal text-(--obra-muted-texto) ' + fundo + SO_MD}>{dataBR(e.fimBase)}</td>
      <td className={CELULA + ' ' + fundo}>
        <Delta dias={e.delta} />
      </td>
      <td className={CELULA + ' ' + fundo + SO_MD} />
      {editavel ? <td className={CELULA + ' ' + fundo} /> : null}
    </tr>
  )
}

function LinhaDeAtividade({
  a,
  cor,
  editavel,
  comColunaTrava,
  edicoes,
  focada,
  onFoco,
}: {
  a: LinhaAtividade
  cor: string
  editavel: boolean
  comColunaTrava: boolean
  edicoes: Edicoes
  focada: boolean
  onFoco: (chave: string | null) => void
}) {
  const fundo = focada ? 'bg-[#f3f6f9]' : 'bg-(--obra-card)'
  const preds = [a.pred1, a.pred2].filter((p) => p !== null).join(', ')
  return (
    <tr
      onMouseEnter={() => onFoco('a:' + a.numero)}
      onFocusCapture={() => onFoco('a:' + a.numero)}
    >
      <td className={CELULA + ' sticky left-0 z-[1] w-14 ' + NUM + ' text-(--obra-muted-texto) ' + fundo}>
        <span className="flex items-center gap-1.5 pl-3">
          <span aria-hidden="true" className="h-4 w-0.5 rounded-full" style={{ backgroundColor: cor }} />
          {a.numero}
        </span>
      </td>
      <td className={CELULA + ' max-w-48 md:sticky md:left-14 md:z-[1] md:max-w-72 pl-5 ' + fundo}>
        <span className="flex min-w-0 items-center gap-1.5">
          {a.travada ? (
            <span title="Travada pela atividade-trava" className="shrink-0 text-[#4f5b62]">
              <IconeCadeado tamanho={13} />
              <span className="sr-only">Travada</span>
            </span>
          ) : null}
          <Editavel
            editavel={editavel}
            rotulo={`Editar nome da atividade ${a.numero}`}
            exibir={<span className="truncate">{a.descricao}</span>}
            inicial={a.descricao}
            tipo="text"
            className="min-w-0 truncate"
            onSalvar={(v) => edicoes.descricao(a.numero, v)}
          />
        </span>
        <BarraMovel percentual={a.percentual} />
      </td>
      <td className={CELULA + ' ' + fundo}>
        <PilulaSituacao situacao={a.situacao} status={a.status} travada={a.travada} />
      </td>
      <td className={CELULA + ' ' + fundo}>
        <Percentual valor={a.percentual} />
      </td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo + SO_MD}>
        <Editavel
          editavel={editavel}
          rotulo={`Editar dias úteis da atividade ${a.numero}`}
          exibir={a.duracao}
          inicial={String(a.duracao)}
          tipo="number"
          onSalvar={(v) => edicoes.duracao(a.numero, Number(v))}
        />
      </td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo}>
        <Editavel
          editavel={editavel}
          rotulo={`Editar início da atividade ${a.numero}`}
          exibir={
            <span className="inline-flex items-center gap-1">
              {dataBR(a.inicioPrevisto)}
              {a.inicioFixo ? (
                <span
                  className="rounded border border-(--obra-border) px-1 text-[10px] font-semibold uppercase text-(--obra-ink)"
                  title={a.inicioFixoAjustado ? 'Início fixo caiu em folga — foi para o próximo dia útil' : 'Início fixo'}
                >
                  fixo
                </span>
              ) : null}
              {a.alertaInicioFixo || a.inicioFixoAjustado ? (
                <span
                  className="text-(--obra-yellow-texto)"
                  title={a.alertaInicioFixo ?? 'Caiu em folga — foi para o próximo dia útil'}
                >
                  <IconeAlerta tamanho={13} />
                  <span className="sr-only">{a.alertaInicioFixo ?? 'Caiu em folga — foi para o próximo dia útil'}</span>
                </span>
              ) : null}
            </span>
          }
          inicial={a.inicioFixo ?? a.inicioPrevisto}
          tipo="date"
          onSalvar={(v) => v && edicoes.inicio(a.numero, v)}
          extra={
            a.inicioFixo
              ? (fechar) => (
                  <button
                    type="button"
                    className="h-9 whitespace-nowrap rounded-md border border-(--obra-border) px-2 font-sans text-[12px] text-(--obra-ink) hover:bg-(--obra-surface)"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      fechar()
                      edicoes.inicio(a.numero, null)
                    }}
                  >
                    Seguir predecessoras
                  </button>
                )
              : undefined
          }
        />
      </td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo}>
        <Editavel
          editavel={editavel}
          rotulo={`Editar fim da atividade ${a.numero}`}
          exibir={dataBR(a.fimPrevisto)}
          inicial={a.fimPrevisto}
          tipo="date"
          onSalvar={(v) => v && edicoes.fim(a.numero, v)}
        />
      </td>
      <td className={CELULA + ' ' + NUM + ' text-(--obra-muted-texto) ' + fundo + SO_MD}>{dataBR(a.inicioBase)}</td>
      <td className={CELULA + ' ' + NUM + ' text-(--obra-muted-texto) ' + fundo + SO_MD}>{dataBR(a.fimBase)}</td>
      <td className={CELULA + ' ' + fundo}>
        <Delta dias={a.delta} />
      </td>
      <td className={CELULA + ' ' + NUM + ' ' + fundo + SO_MD}>
        <Editavel
          editavel={editavel}
          rotulo={`Editar predecessoras da atividade ${a.numero}`}
          exibir={preds || '—'}
          inicial={preds}
          tipo="text"
          onSalvar={(v) => edicoes.predecessoras(a.numero, lerPredecessoras(v))}
        />
      </td>
      {comColunaTrava ? (
        <td className={CELULA + ' ' + fundo}>
          <label className="flex h-11 w-11 cursor-pointer items-center justify-center" title="Bloqueia pela atividade-trava">
            <input
              type="checkbox"
              className="h-4 w-4 accent-(--obra-ink)"
              checked={a.bloqueiaPorTrava}
              disabled={!editavel}
              onChange={(e) => edicoes.trava(a.numero, e.target.checked)}
              aria-label={`Atividade ${a.numero} bloqueia pela trava`}
            />
          </label>
        </td>
      ) : null}
    </tr>
  )
}

function Percentual({ valor }: { valor: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <AnelProgresso valor={valor} tamanho={22} espessura={3} />
      <span className="obra-num text-[12px]">{pct(valor)}</span>
    </span>
  )
}

/** Barrinha de % dentro da linha — só no celular (sem Gantt). */
function BarraMovel({ percentual }: { percentual: number }) {
  return (
    <span aria-hidden="true" className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-(--obra-trilho) lg:hidden">
      <span
        className="block h-full rounded-full"
        style={{
          width: pct(Math.min(1, Math.max(0, percentual))),
          backgroundColor: percentual >= 1 ? 'var(--obra-verde)' : 'var(--obra-orange)',
        }}
      />
    </span>
  )
}
