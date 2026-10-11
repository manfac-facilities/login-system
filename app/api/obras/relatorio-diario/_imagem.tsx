/**
 * A imagem do e-mail diário: o Painel gerencial redesenhado para o Satori
 * (`ImageResponse` de `next/og`), 900 px de largura — spec §5.
 *
 * Medidas = CSS `.img` do mockup aprovado (`docs/relatorio-email/2026-10-08-mockup-email-painel.html`,
 * desenhado a 1200 px) × 0,75. Textos e números saem prontos de `painel`, com os
 * formatadores da tela.
 *
 * ALTURA: o `ImageResponse` exige a altura e corta o que passar. Por isso cada
 * bloco declara a própria altura (`h`) e é desenhado numa caixa com exatamente
 * essa altura; `alturaDaImagem` é a soma. Toda linha de
 * tabela tem altura fixa e texto numa linha só; os textos que quebram ficam em
 * caixas com número fixo de linhas.
 *
 * Satori: só flex e posição absoluta; todo `div` com mais de um filho tem
 * `display: flex`. Os "componentes" aqui são funções comuns (chamadas, não
 * montadas), para a árvore inteira ser de elementos simples — o teste a percorre.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { ImageResponse } from 'next/og'
import { diasDesde, somaDias } from '../../../obras/_lib/tipos'
import { MESES_CURTOS, MESES_LONGOS, INICIO_DOS_DADOS, type Painel, type Sla } from '../../../obras/painel/_calculos'
import { K, N0, N1, R, fd, mesCurto } from '../../../obras/painel/_ui'
import { recorteDoCronograma } from './_recorte'

// ============================================================
// Medidas e cores
// ============================================================

export const LARGURA = 900
const PAD_X = 30
const PAD_T = 27
const PAD_B = 22
/** Largura útil: 900 − 2 × 30. */
const W = LARGURA - 2 * PAD_X

const C = {
  fundo: '#0a1628',
  navy: '#0d2050',
  card: '#0b1b36',
  ctx: '#081426',
  borda: '#1e3a5f',
  borda2: '#294b78',
  txt: '#e8eef7',
  mut: '#94a3b8',
  mut2: '#64748b',
  lar: '#f05a28',
  lar2: '#ff7849',
  azul: '#5aa9f0',
  verde: '#35c98a',
  verm: '#ff4d6d',
  amb: '#f4b73f',
  trilho: '#071225',
}
const MONO = 'JetBrains Mono'

/**
 * Corta o texto em `max` caracteres, com reticências. Em vez de `overflow: hidden`
 * + `textOverflow`: cada recorte vira uma máscara do tamanho da imagem inteira no
 * Resvg, e com centenas delas o render de 900 × 3700 passava de 5 minutos.
 */
export const cortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)

/** Linha de texto com altura fixa, sem quebra. Texto variável passa por `cortar`. */
const linha = (size: number, lh: number, extra: CSSProperties = {}): CSSProperties => ({
  fontSize: size,
  lineHeight: `${lh}px`,
  height: lh,
  whiteSpace: 'nowrap',
  ...extra,
})

const flex = (s: CSSProperties = {}): CSSProperties => ({ display: 'flex', ...s })
const col = (s: CSSProperties = {}): CSSProperties => ({ display: 'flex', flexDirection: 'column', ...s })

type Bloco = { h: number; el: ReactElement }

/**
 * Texto que quebra linha com trechos de estilos diferentes: cada palavra vira
 * um item de flex (o Satori não faz texto "inline" misto). `linhas` fixa a altura.
 */
function texto(
  partes: { t: string; s?: CSSProperties }[],
  o: { size: number; lh: number; linhas: number; cor: string }
): ReactElement {
  const palavras: ReactElement[] = []
  partes.forEach((p, i) =>
    p.t
      .split(' ')
      .filter(Boolean)
      .forEach((w, j) =>
        palavras.push(
          <span key={`${i}-${j}`} style={{ color: o.cor, ...p.s }}>
            {w}
          </span>
        )
      )
  )
  return (
    <div
      style={flex({
        flexWrap: 'wrap',
        columnGap: Math.round(o.size * 0.28),
        fontSize: o.size,
        lineHeight: `${o.lh}px`,
        height: o.lh * o.linhas,
      })}
    >
      {palavras}
    </div>
  )
}

// ============================================================
// Peças (as do `_ui.tsx` da tela, em estilo inline)
// ============================================================

function pilula(t: string, size = 11.25): ReactElement {
  return (
    <div
      style={linha(size, 15, {
        flexShrink: 0,
        height: 21,
        padding: '2px 9px',
        border: `1px solid ${C.borda2}`,
        background: 'rgba(90,169,240,.09)',
        color: C.azul,
        fontWeight: 700,
        borderRadius: 99,
      })}
    >
      {t}
    </div>
  )
}

/** Seção: título, subtítulo (com número fixo de linhas) e a pílula de posição. */
function secao(titulo: string, sub: string, linhasSub: number, pos: string | null, corpo: Bloco): Bloco {
  const TOPO = 26
  const cab = 28 + linhasSub * 17 + 9
  return {
    h: TOPO + cab + corpo.h,
    el: (
      <div style={col({ marginTop: TOPO, height: cab + corpo.h })}>
        <div style={flex({ height: cab - 9, marginBottom: 9, alignItems: 'flex-end', justifyContent: 'space-between' })}>
          <div style={col({ flex: 1, minWidth: 0 })}>
            <div style={linha(22.5, 28, { color: C.txt, fontWeight: 700 })}>{titulo}</div>
            <div style={{ fontSize: 12.75, lineHeight: '17px', height: linhasSub * 17, color: C.mut }}>
              {sub}
            </div>
          </div>
          {pos ? <div style={flex({ marginLeft: 12, marginBottom: 2 })}>{pilula(pos)}</div> : null}
        </div>
        <div style={col({ height: corpo.h })}>{corpo.el}</div>
      </div>
    ),
  }
}

const CARD: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${C.borda}`,
  background: C.card,
  borderRadius: 10.5,
}

/** Cabeçalho de cartão: 58 px com subtítulo. */
const CARDH = 58
function cardH(titulo: string, sub: string): ReactElement {
  return (
    <div style={col({ height: CARDH, padding: '9px 13.5px', borderBottom: `1px solid ${C.borda}`, flexShrink: 0 })}>
      <div style={linha(16.5, 21, { color: C.txt, fontWeight: 700 })}>{titulo}</div>
      <div style={linha(12, 16, { color: C.mut2, marginTop: 1.5 })}>{sub}</div>
    </div>
  )
}

/** Variação contra o período de comparação — `Delta` da tela. Caixa de 2 linhas. */
const DELTA_H = 34
function delta(atual: number, anterior: number | null, maiorMelhor: boolean, rotulo: string): ReactElement {
  let cor = C.mut
  let fundo = 'rgba(148,163,184,.1)'
  let forte = '—'
  let fraco = `${rotulo}: sem base`
  if (anterior) {
    const p = ((atual - anterior) / anterior) * 100
    const plano = Math.abs(p) < 0.5
    const bom = p >= 0 === maiorMelhor
    if (!plano) {
      cor = bom ? C.verde : C.verm
      fundo = bom ? 'rgba(53,201,138,.1)' : 'rgba(255,77,109,.1)'
    }
    forte = `${plano ? '=' : p >= 0 ? '▲' : '▼'} ${N1(Math.abs(p))}%`
    fraco = rotulo
  }
  return (
    <div style={flex({ alignSelf: 'flex-start', maxWidth: '100%' })}>
      <div
        style={flex({
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 4.5,
          borderRadius: 9,
          padding: '2px 9px',
          background: fundo,
          color: cor,
        })}
      >
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, lineHeight: '15px' }}>{forte}</span>
        {fraco ? <span style={{ fontSize: 10.5, lineHeight: '15px', color: C.mut2 }}>{fraco}</span> : null}
      </div>
    </div>
  )
}

/** Barra até a meta + "N% da meta" / rótulo da meta (2 linhas), ou "Sem meta". */
const PROG_H = 52.5
function progresso(valor: number, meta: number | null, rotuloMeta?: string): ReactElement {
  if (!meta) {
    return (
      <div style={col({ height: PROG_H, paddingTop: 9 })}>
        <div style={linha(11.25, 15, { color: C.mut2, height: 24.5, padding: '3.75px 7.5px', border: `1px dashed ${C.borda2}`, borderRadius: 6 })}>
          Sem meta — obras pontuais
        </div>
      </div>
    )
  }
  const pc = (valor / meta) * 100
  return (
    <div style={col({ height: PROG_H, paddingTop: 9 })}>
      <div style={flex({ height: 9, borderRadius: 99, background: C.trilho })}>
        <div style={{ width: `${Math.min(100, pc)}%`, height: 9, borderRadius: 99, background: pc >= 100 ? C.verde : C.lar }} />
      </div>
      <div style={flex({ marginTop: 4.5, height: 15, fontSize: 11.25, lineHeight: '15px' })}>
        <span style={{ color: C.txt, fontWeight: 700 }}>{`${N0(pc)}%`}</span>
        <span style={{ color: C.mut2, marginLeft: 3 }}>da meta</span>
      </div>
      <div style={linha(11.25, 15, { color: C.mut2 })}>{rotuloMeta ?? `meta ${R(meta)}`}</div>
    </div>
  )
}

/** Mini-cartão (`.mini`). `n`/`m` em caixas de linhas fixas; `extra` = um delta. */
type Mini = {
  rotulo: string
  valor: ReactNode
  cor?: string
  n?: ReactNode
  m?: ReactNode
  extra?: ReactElement | null
  linhasN?: number
  linhasM?: number
  padX?: number
}
const MINI_BASE = 2 + 9 + 14 + 4.5 + 32 + 9
function alturaMini(x: Pick<Mini, 'n' | 'm' | 'extra' | 'linhasN' | 'linhasM'>): number {
  return (
    MINI_BASE +
    (x.n !== undefined ? (x.linhasN ?? 2) * 15.5 : 0) +
    (x.m !== undefined ? 3 + (x.linhasM ?? 1) * 15 : 0) +
    (x.extra !== undefined ? 6 + DELTA_H : 0)
  )
}
function mini(x: Mini): ReactElement {
  const caixaN = (x.linhasN ?? 2) * 15.5
  return (
    <div
      style={col({
        flex: 1,
        minWidth: 0,
        border: `1px solid ${C.borda}`,
        background: 'rgba(13,32,80,.45)',
        borderRadius: 9,
        padding: `9px ${x.padX ?? 10.5}px`,
      })}
    >
      <div style={linha(10.5, 14, { color: C.mut, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 })}>
        {x.rotulo}
      </div>
      <div style={flex({ marginTop: 4.5, height: 32, alignItems: 'flex-end', whiteSpace: 'nowrap' })}>
        {typeof x.valor === 'string' || typeof x.valor === 'number' ? (
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 25.5, lineHeight: '32px', color: x.cor ?? C.txt }}>
            {String(x.valor)}
          </span>
        ) : (
          x.valor
        )}
      </div>
      {x.n !== undefined ? (
        typeof x.n === 'string' ? (
          <div style={{ fontSize: 12, lineHeight: '15.5px', height: caixaN, color: C.mut }}>{x.n}</div>
        ) : (
          <div style={flex({ height: caixaN })}>{x.n}</div>
        )
      ) : null}
      {x.m !== undefined ? (
        <div style={{ marginTop: 3, fontSize: 11.25, lineHeight: '15px', height: (x.linhasM ?? 1) * 15, color: C.mut2 }}>
          {x.m}
        </div>
      ) : null}
      {x.extra !== undefined ? <div style={col({ marginTop: 6, height: DELTA_H })}>{x.extra}</div> : null}
    </div>
  )
}

/** Valor grande + " dias" pequeno, como na tela. */
function valorDias(v: string, cor: string): ReactElement {
  return (
    <div style={flex({ alignItems: 'flex-end' })}>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 25.5, lineHeight: '32px', color: cor }}>{v}</span>
      <span style={{ fontSize: 12.75, lineHeight: '26px', color: C.mut, marginLeft: 5 }}>dias</span>
    </div>
  )
}

function barra(pct: number, cor: string, altura = 7): ReactElement {
  return (
    <div style={flex({ width: '100%', height: altura, borderRadius: 99, background: C.trilho })}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: altura, borderRadius: 99, background: cor }} />
    </div>
  )
}

function tag(cor: string, t: string): ReactElement {
  return (
    <span
      style={{
        fontSize: 10.5,
        lineHeight: '14px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        color: cor,
        border: `1px solid ${cor}73`,
        background: `${cor}14`,
        borderRadius: 99,
        padding: '0 6px',
      }}
    >
      {t}
    </span>
  )
}

const VAZIO_H = 45
function vazio(t: string): ReactElement {
  return (
    <div style={flex({ height: VAZIO_H, alignItems: 'center', justifyContent: 'center', fontSize: 13.5, color: C.mut2 })}>
      {t}
    </div>
  )
}

// Tabelas: linha 33 px, cabeçalho 28, total 34.
const TR_H = 28
const TR = 33
const TR_TOT = 34
type Celula = { t: ReactNode; flex: number; dir?: boolean; mono?: boolean; s?: CSSProperties }
/** `topo`: primeira linha do cartão — arredonda os cantos (sem `overflow: hidden`, ver `cortar`). */
function trCab(cels: Celula[], topo = false): ReactElement {
  return (
    <div
      style={flex({
        height: TR_H,
        flexShrink: 0,
        ...(topo ? { borderRadius: '9.5px 9.5px 0 0' } : {}),
        alignItems: 'center',
        padding: '0 13.5px',
        columnGap: 9,
        background: C.navy,
        color: C.mut,
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      })}
    >
      {cels.map((c, i) => celula(c, i))}
    </div>
  )
}
/** `fundo`: última linha do cartão — arredonda os cantos de baixo. */
function tr(cels: Celula[], o: { total?: boolean; altura?: number; fundo?: boolean } = {}): ReactElement {
  return (
    <div
      style={flex({
        height: o.altura ?? (o.total ? TR_TOT : TR),
        flexShrink: 0,
        ...(o.fundo ? { borderRadius: '0 0 9.5px 9.5px' } : {}),
        alignItems: 'center',
        padding: '0 13.5px',
        columnGap: 9,
        fontSize: 14,
        color: C.txt,
        borderTop: o.total ? `2px solid ${C.borda2}` : `1px solid ${C.borda}`,
        ...(o.total ? { background: 'rgba(13,32,80,.55)' } : {}),
        fontWeight: o.total ? 700 : 400,
      })}
    >
      {cels.map((c, i) => celula(c, i))}
    </div>
  )
}
function celula(c: Celula, i: number): ReactElement {
  return (
    <div
      key={i}
      style={flex({
        flex: c.flex,
        minWidth: 0,
        whiteSpace: 'nowrap',
        justifyContent: c.dir ? 'flex-end' : 'flex-start',
        alignItems: 'center',
        ...(c.mono ? { fontFamily: MONO } : {}),
        ...c.s,
      })}
    >
      {typeof c.t === 'string' ? (
        <span style={{ whiteSpace: 'nowrap' }}>{c.t}</span>
      ) : (
        c.t
      )}
    </div>
  )
}

// ============================================================
// Regras próprias da imagem
// ============================================================

/** Faixa "Atenção aos totais": mais de 25% da carteira sem valor (spec §5.3, 0b). */
export function mostraFaixaDosTotais(painel: Painel): boolean {
  return painel.kpis.carteira.semValor * 4 > painel.kpis.carteira.qtd
}

/** Valor grande do cartão: 24 px; cai para 20 px acima de 12 caracteres (spec §5.6). */
export function fonteDoValorKpi(texto: string): number {
  return texto.length > 12 ? 20 : 24
}

// ============================================================
// Blocos
// ============================================================

function cabecalho(painel: Painel, lidoEm: string): Bloco {
  const P = painel.periodo
  const cmp = painel.filtro.cmp === 'prev' ? `${fd(P.pa)}–${fd(P.pb)}` : `${fd(P.pa)}–${fd(P.pb)}/${P.ano - 1}`
  return {
    h: 146,
    el: (
      <div style={col({ height: 146 })}>
        <div style={linha(12, 16, { color: C.lar2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.44 })}>
          Gestão de Obras · uso interno
        </div>
        <div style={linha(34, 38, { marginTop: 4.5, color: C.txt, fontWeight: 700 })}>Painel gerencial</div>
        <div style={linha(13.5, 18, { marginTop: 3, color: C.mut })}>
          Metas, carteira, faturamento, prazos, equipes e obras paradas.
        </div>
        <div
          style={flex({
            marginTop: 10.5,
            height: 56,
            alignItems: 'center',
            justifyContent: 'space-between',
            border: `1px solid ${C.borda}`,
            borderRadius: 9,
            background: C.ctx,
            padding: '9px 13.5px',
          })}
        >
          <div style={col({ minWidth: 0 })}>
            <div style={linha(15, 20, { color: C.txt, fontWeight: 700 })}>
              {`${painel.clienteNome ?? 'Todos os clientes'} · ${MESES_LONGOS[P.mes - 1]} ${P.ano}`}
            </div>
            <div style={linha(12, 16, { color: C.mut })}>
              {`${fd(P.a)} a ${fd(P.b)}${P.parcial ? ' (mês em curso)' : ''} · comparando com ${cmp}`}
            </div>
          </div>
          {pilula(`Lido em ${lidoEm}`, 12)}
        </div>
      </div>
    ),
  }
}

function faixaDosTotais(painel: Painel): Bloco | null {
  if (!mostraFaixaDosTotais(painel)) return null
  const { semValor, qtd } = painel.kpis.carteira
  return {
    h: 13.5 + 51,
    el: (
      <div
        style={col({
          marginTop: 13.5,
          height: 51,
          border: `1px dashed ${C.borda2}`,
          borderRadius: 9,
          padding: '7.5px 12px',
        })}
      >
        {texto(
          [
            { t: 'Atenção aos totais.', s: { color: C.txt, fontWeight: 700 } },
            {
              t: `${semValor} das ${qtd} obras ainda não têm valor em R$ no hub. Os totais em R$ crescem conforme o valor for preenchido nas fichas.`,
            },
          ],
          { size: 12.75, lh: 17, linhas: 2, cor: C.mut }
        )}
      </div>
    ),
  }
}

const posicaoHoje = (painel: Painel) => `Posição de hoje, ${fd(painel.hoje)}`
const rotuloCmp = (painel: Painel) => {
  const P = painel.periodo
  return painel.filtro.cmp === 'prev' ? `vs ${fd(P.pa)}–${fd(P.pb)}` : `vs ${fd(P.pa)}–${fd(P.pb)}/${P.ano - 1}`
}

const KPI_H = 255
function metas(painel: Painel): Bloco {
  const { kpis: k, metas: mt, periodo: P, porCliente } = painel
  const rc = rotuloCmp(painel)
  const pctPend = k.carteira.valor ? (k.pendente.valor / k.carteira.valor) * 100 : 0

  const kpi = (rotulo: string, valor: number, cor: string, d: string, resto: ReactElement[]) => {
    const t = R(valor)
    return (
      <div
        style={col({
          flex: 1,
          minWidth: 0,
          height: KPI_H,
          border: `1px solid ${C.borda}`,
          background: C.navy,
          borderRadius: 10.5,
          padding: 12,
        })}
      >
        <div style={linha(11.25, 15, { color: C.mut, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 })}>
          {rotulo}
        </div>
        <div style={linha(fonteDoValorKpi(t), 30, { marginTop: 6, marginBottom: 1.5, fontFamily: MONO, fontWeight: 700, color: cor })}>
          {t}
        </div>
        <div style={{ fontSize: 12, lineHeight: '15.5px', height: 31, color: C.mut }}>{d}</div>
        {resto}
      </div>
    )
  }
  const caixaDelta = (key: string, el: ReactElement) => (
    <div key={key} style={col({ marginTop: 7.5, height: DELTA_H })}>
      {el}
    </div>
  )
  const chip = (r: string, v: string) => (
    <div key={r} style={flex({ height: 15, justifyContent: 'space-between', fontSize: 11.25, lineHeight: '15px' })}>
      <span style={{ color: C.mut }}>{r}</span>
      <span style={{ color: C.txt, fontFamily: MONO, fontWeight: 700 }}>{v}</span>
    </div>
  )
  const fatZero = k.faturamentoMes.valor === 0
  const pendZero = k.pendente.valor === 0
  const ano = k.faturadoAno
  const rotuloMetaAno =
    mt.faturamento && ano.metaAcumulada && ano.metaDesde
      ? `meta ${Math.round(ano.metaAcumulada / mt.faturamento)}×${K(mt.faturamento)} desde ${mesCurto(ano.metaDesde)}`
      : undefined

  const linhaKpis = (
    <div style={flex({ height: KPI_H, gap: 12 })}>
      {kpi(
        'Carteira de obras',
        k.carteira.valor,
        C.txt,
        `${k.carteira.qtd} obras com a gente${k.carteira.semValor ? ` · ${k.carteira.semValor} sem valor` : ''}`,
        [
          <div key="p" style={col()}>{progresso(k.carteira.valor, mt.carteira)}</div>,
          caixaDelta('d', delta(k.carteira.valor, k.carteira.anterior, true, rc)),
          <div key="c" style={col({ marginTop: 6, height: 45 })}>
            {chip('A iniciar', K(k.carteira.iniciar))}
            {chip('Andamento', K(k.carteira.andamento))}
            {chip('Pend. fat.', K(k.carteira.pendFat))}
          </div>,
        ]
      )}
      {kpi(
        'Faturamento do mês',
        k.faturamentoMes.valor,
        fatZero ? C.mut : C.txt,
        `${fatZero ? 'nenhuma NF emitida' : 'NF emitida'} de ${fd(P.a)} a ${fd(P.b)}`,
        [
          <div key="p" style={col()}>{progresso(k.faturamentoMes.valor, mt.faturamento)}</div>,
          caixaDelta('d', delta(k.faturamentoMes.valor, k.faturamentoMes.anterior, true, rc)),
        ]
      )}
      {kpi('Faturado no ano', ano.valor, C.txt, `acumulado jan–${MESES_CURTOS[P.mes - 1]}/${P.ano}`, [
        <div key="p" style={col()}>{progresso(ano.valor, ano.metaAcumulada, rotuloMetaAno)}</div>,
        caixaDelta('d', delta(ano.valor, ano.anterior, true, `vs mesmo período de ${P.ano - 1}`)),
      ])}
      {kpi('Pendente faturamento', k.pendente.valor, pendZero ? C.mut : C.amb, `${k.pendente.qtd} obras liberadas, aguardando NF`, [
        <div key="x" style={col({ paddingTop: 9, height: 33.5 })}>
          <div style={linha(11.25, 15, { height: 24.5, color: C.mut2, padding: '3.75px 7.5px', border: `1px solid ${C.borda2}`, borderRadius: 6 })}>
            {`Parte da carteira: ${N0(pctPend)}% do total`}
          </div>
        </div>,
        caixaDelta('d', delta(k.pendente.valor, k.pendente.anterior, false, rc)),
      ])}
    </div>
  )

  const pc = (v: number, m: number | null) =>
    m ? <span style={{ color: v >= m ? C.verde : C.mut }}>{`${N0((v / m) * 100)}%`}</span> : <span style={{ color: C.mut2 }}>sem meta</span>
  const colunas = (l: (typeof porCliente.linhas)[number]): Celula[] => [
    { t: <span style={{ fontWeight: 700 }}>{cortar(l.nome, 18)}</span>, flex: 1.2 },
    { t: R(l.carteira), flex: 1, dir: true, mono: true },
    { t: pc(l.carteira, l.metaCarteira), flex: 0.6, dir: true },
    { t: R(l.faturadoMes), flex: 1, dir: true, mono: true, s: l.faturadoMes === 0 ? { color: C.mut } : {} },
    { t: pc(l.faturadoMes, l.metaFaturamento), flex: 0.6, dir: true },
    { t: R(l.faturadoAno), flex: 1, dir: true, mono: true },
    {
      t: (
        <div style={flex({ alignItems: 'center' })}>
          <span>{R(l.pendente)}</span>
          <span style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 11.25, color: C.mut2, marginLeft: 6 }}>{`(${l.pendenteQtd})`}</span>
        </div>
      ),
      flex: 1.3,
      dir: true,
      mono: true,
    },
  ]
  const n = porCliente.linhas.length
  const alturaTabela = 2 + CARDH + TR_H + n * TR + TR_TOT
  const tabela = (
    <div style={{ ...CARD, marginTop: 10.5, height: alturaTabela, flexShrink: 0 }}>
      {cardH('Quanto cada cliente representa', 'A linha Todos é a soma, e as metas somam junto.')}
      {trCab([
        { t: 'Cliente', flex: 1.2 },
        { t: 'Carteira', flex: 1, dir: true },
        { t: '% meta', flex: 0.6, dir: true },
        { t: 'Fat. no mês', flex: 1, dir: true },
        { t: '% meta', flex: 0.6, dir: true },
        { t: 'Fat. no ano', flex: 1, dir: true },
        { t: 'Pend. faturamento', flex: 1.3, dir: true },
      ])}
      {porCliente.linhas.map((l) => <div key={l.chave} style={col()}>{tr(colunas(l))}</div>)}
      {tr(colunas(porCliente.total), { total: true, fundo: true })}
    </div>
  )
  return secao(
    'Metas: carteira e faturamento',
    'Carteira é tudo que está com a gente: a iniciar, em andamento e pendente de faturamento. Faturamento é o que teve nota fiscal emitida.',
    2,
    posicaoHoje(painel),
    {
      h: KPI_H + 10.5 + alturaTabela,
      el: (
        <div style={col()}>
          {linhaKpis}
          {tabela}
        </div>
      ),
    }
  )
}

function resumo(painel: Painel): Bloco {
  const { linhas, total } = painel.resumo
  const h = 2 + TR_H + linhas.length * TR + TR_TOT
  return secao('Resumo por status', 'Quantidade e valor em cada etapa do sistema.', 1, posicaoHoje(painel), {
    h,
    el: (
      <div style={{ ...CARD, height: h }}>
        {trCab([
          { t: 'Etapa', flex: 2.4 },
          { t: 'Qtd', flex: 0.5, dir: true },
          { t: 'Valor total', flex: 1.1, dir: true },
          { t: 'Participação', flex: 1.6, s: { paddingLeft: 16.5 } },
        ], true)}
        {linhas.map((l) => (
          <div key={l.etapa} style={col()}>
            {tr([
              { t: l.nome, flex: 2.4 },
              { t: String(l.qtd), flex: 0.5, dir: true, mono: true },
              { t: R(l.valor), flex: 1.1, dir: true, mono: true },
              { t: barra(total.valor ? (l.valor / total.valor) * 100 : 0, C.azul), flex: 1.6, s: { paddingLeft: 16.5 } },
            ])}
          </div>
        ))}
        {tr(
          [
            { t: 'Total geral = carteira', flex: 2.4 },
            { t: String(total.qtd), flex: 0.5, dir: true, mono: true },
            { t: R(total.valor), flex: 1.1, dir: true, mono: true },
            {
              t: total.semValor ? `${total.semValor} obras sem valor informado` : posicaoHoje(painel),
              flex: 1.6,
              s: { paddingLeft: 16.5, fontSize: 11.25, fontWeight: 400, color: C.mut2 },
            },
          ],
          { total: true, fundo: true }
        )}
      </div>
    ),
  })
}

const MINI_SLA: Pick<Mini, 'n' | 'm' | 'extra'> = { n: '', extra: null }
const FAIXAS_H = 10.5 + 4 * 16 + 3 * 4.5
const ESPERA_H = 10.5 + 1 + 7.5 + 3 * 15.5
const SLA_H = 2 + CARDH + 12 + alturaMini(MINI_SLA) + FAIXAS_H + ESPERA_H + 12

function cartaoSla(painel: Painel, titulo: string, sub: string, sla: Sla): ReactElement {
  const mx = Math.max(1, ...sla.faixas.map((f) => f.qtd))
  const esp = sla.esperando
  const p = sla.pior
  return (
    <div style={{ ...CARD, flex: 1, minWidth: 0, height: SLA_H }}>
      {cardH(titulo, sub)}
      <div style={col({ padding: '12px 13.5px' })}>
        <div style={flex({ gap: 12, height: alturaMini(MINI_SLA) })}>
          {mini({
            rotulo: 'Média',
            valor: valorDias(sla.media !== null ? N1(sla.media) : '—', C.txt),
            n: `${sla.concluidas.length} obras concluíram a etapa no mês`,
            extra:
              sla.media !== null && sla.mediaAnterior !== null
                ? delta(sla.media, sla.mediaAnterior, false, rotuloCmp(painel))
                : null,
          })}
          {mini({
            rotulo: 'Pior caso',
            valor: valorDias(p ? String(p.dias) : '—', C.verm),
            n: p
              ? texto([{ t: p.obra.os ?? 'sem OS', s: { fontFamily: MONO, fontSize: 11.25, color: C.mut2 } }, { t: `· ${p.obra.loja ?? ''}` }], {
                  size: 12,
                  lh: 15.5,
                  linhas: 2,
                  cor: C.mut,
                })
              : 'nenhuma obra no mês',
            m: p ? `${p.obra.cliente} · ${p.obra.semValor ? 'sem valor' : R(p.obra.valor)}` : '',
          })}
        </div>
        <div style={col({ marginTop: 10.5, height: FAIXAS_H - 10.5, gap: 4.5 })}>
          {sla.faixas.map((f) => (
            <div key={f.rotulo} style={flex({ height: 16, alignItems: 'center', fontSize: 12, color: C.mut })}>
              <span style={{ width: 72, flexShrink: 0 }}>{f.rotulo}</span>
              <div style={flex({ flex: 1, height: 9, margin: '0 9px', borderRadius: 99, background: C.trilho })}>
                <div style={{ width: `${(f.qtd / mx) * 100}%`, height: 9, borderRadius: 99, background: f.cor }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, width: 68, fontFamily: MONO, fontWeight: 700, color: C.txt }}>{`${f.qtd} obras`}</div>
            </div>
          ))}
        </div>
        <div style={col({ marginTop: 10.5, borderTop: `1px solid ${C.borda}`, paddingTop: 7.5, height: ESPERA_H - 10.5 })}>
          {texto(
            [
              { t: `Ainda esperando hoje (${fd(painel.hoje)}):` },
              { t: `${esp.qtd} obras · ${R(esp.valor)}`, s: { color: C.txt, fontWeight: 700 } },
              ...(esp.maisAntiga
                ? [
                    { t: '· a mais antiga espera há' },
                    { t: `${esp.maisAntiga.dias} dias`, s: { color: C.verm, fontWeight: 700 } },
                    { t: `(${esp.maisAntiga.obra.os ?? 'sem OS'} · ${esp.maisAntiga.obra.loja ?? ''})` },
                  ]
                : []),
            ],
            { size: 12, lh: 15.5, linhas: 3, cor: C.mut }
          )}
        </div>
      </div>
    </div>
  )
}

function slas(painel: Painel): Bloco {
  return secao(
    'Prazos de resposta (SLA)',
    'Média e pior caso das obras que concluíram a etapa no mês, e o que ainda está esperando agora.',
    1,
    null,
    {
      h: SLA_H,
      el: (
        <div style={flex({ gap: 12, height: SLA_H })}>
          {cartaoSla(painel, 'Pendente faturamento → NF emitida', 'Dias entre a liberação para faturar e a emissão da nota', painel.slaPendFat)}
          {cartaoSla(painel, 'Liberação para executar → OS aprovada', 'Dias entre a obra ser liberada e o cliente aprovar a OS', painel.slaOS)}
        </div>
      ),
    }
  )
}

const TR_EQ = 48
const AVISO_EQ_H = 12 + 51 + 12
function equipes(painel: Painel): Bloco {
  const { linhas, total } = painel.equipes
  const mx = Math.max(1, ...linhas.map((l) => l.receita))
  const corpoH = linhas.length ? linhas.length * TR_EQ + TR_TOT : VAZIO_H
  const h = 2 + TR_H + corpoH + AVISO_EQ_H
  const F = { n: 0.3, eq: 1.3, rec: 1.2, ob: 0.75, di: 0.7, pr: 1, dm: 0.7, ba: 0.85 }
  return secao('Equipes: receita, dias e produtividade', 'Ranking por receita no mês.', 1, null, {
    h,
    el: (
      <div style={{ ...CARD, height: h }}>
        {trCab([
          { t: '#', flex: F.n },
          { t: 'Equipe', flex: F.eq },
          { t: 'Receita (R$ exec.)', flex: F.rec, dir: true },
          { t: 'Obras concl.', flex: F.ob, dir: true },
          { t: 'Dias nelas', flex: F.di, dir: true },
          { t: 'Produt. (R$/dia)', flex: F.pr, dir: true },
          { t: 'Dias no mês', flex: F.dm, dir: true },
          { t: '', flex: F.ba },
        ], true)}
        {linhas.length ? (
          <div style={col()}>
            {linhas.map((e, i) => (
              <div key={e.chave} style={col()}>
                {tr(
                  [
                    { t: `${i + 1}º`, flex: F.n, mono: true, s: { fontWeight: 700, color: i === 0 ? C.lar2 : C.mut } },
                    { t: <span style={{ fontWeight: 700 }}>{cortar(e.nome, 18)}</span>, flex: F.eq },
                    {
                      t: (
                        <div style={col({ alignItems: 'flex-end' })}>
                          <span>{R(e.receita)}</span>
                          {e.receita || e.receitaAnterior ? (
                            <div style={flex({ marginTop: 3 })}>{delta(e.receita, e.receitaAnterior, true, '')}</div>
                          ) : null}
                        </div>
                      ),
                      flex: F.rec,
                      dir: true,
                      mono: true,
                    },
                    { t: String(e.obrasConcluidas), flex: F.ob, dir: true, mono: true },
                    { t: String(e.diasNessasObras), flex: F.di, dir: true, mono: true },
                    { t: e.produtividade !== null ? R(e.produtividade) : '—', flex: F.pr, dir: true, mono: true, s: { fontWeight: 700 } },
                    { t: String(e.diasNoMes), flex: F.dm, dir: true, mono: true },
                    { t: barra((e.receita / mx) * 100, C.lar), flex: F.ba, s: { paddingLeft: 10.5 } },
                  ],
                  { altura: TR_EQ }
                )}
              </div>
            ))}
            {tr(
              [
                { t: '', flex: F.n },
                { t: 'Total', flex: F.eq },
                { t: R(total.receita), flex: F.rec, dir: true, mono: true },
                { t: String(total.obrasConcluidas), flex: F.ob, dir: true, mono: true },
                { t: String(total.diasNessasObras), flex: F.di, dir: true, mono: true },
                { t: total.produtividade !== null ? R(total.produtividade) : '—', flex: F.pr, dir: true, mono: true },
                { t: String(total.diasNoMes), flex: F.dm, dir: true, mono: true },
                { t: '', flex: F.ba },
              ],
              { total: true }
            )}
          </div>
        ) : (
          vazio('Nenhuma equipe trabalhou para este filtro no mês.')
        )}
        <div style={col({ height: AVISO_EQ_H, padding: '12px 13.5px' })}>
          <div style={col({ height: 51, border: `1px dashed ${C.borda2}`, borderRadius: 9, padding: '7.5px 12px' })}>
            {texto(
              [
                { t: 'Como a conta é feita.', s: { color: C.txt, fontWeight: 700 } },
                {
                  t: 'A receita de uma obra entra no mês em que a execução terminou. Produtividade = receita ÷ dias trabalhados nessas obras.',
                },
              ],
              { size: 12.75, lh: 17, linhas: 2, cor: C.mut }
            )}
          </div>
        </div>
      </div>
    ),
  })
}

const MOTIVO_H = 28
const MINI_AT: Pick<Mini, 'n'> = { n: '' }
const CHIPS_H = 2 * 21.5 + 6
function paradasEAtrasos(painel: Painel): Bloco {
  const { paradas: p, atrasos: a } = painel
  const esqH = 2 + CARDH + 12 + (p.motivos.length ? p.motivos.length * MOTIVO_H : VAZIO_H) + 12
  const dirH = 2 + CARDH + 12 + (a.emCampo ? alturaMini(MINI_AT) + 12 + 15 + 9 + CHIPS_H : VAZIO_H) + 12
  const h = Math.max(esqH, dirH)
  const mx = Math.max(1, ...p.motivos.map((m) => m.valor))
  return secao(
    'Obras paradas e atrasadas',
    'Por que as obras pararam, quanto valor está travado, e quanto das obras em andamento está fora do prazo.',
    1,
    posicaoHoje(painel),
    {
      h,
      el: (
        <div style={flex({ gap: 12, height: h })}>
          <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
            {cardH('Paradas, por motivo', `${p.qtd} obras paradas · ${R(p.valor)} travados`)}
            <div style={col({ padding: '12px 13.5px' })}>
              {p.motivos.length
                ? p.motivos.map((m) => (
                    <div key={m.motivo} style={flex({ height: MOTIVO_H, alignItems: 'center', gap: 9, fontSize: 14, color: C.txt })}>
                      <span style={{ flex: 1.4, minWidth: 0, whiteSpace: 'nowrap' }}>{cortar(m.motivo, 26)}</span>
                      <div style={flex({ flex: 1 })}>{barra((m.valor / mx) * 100, C.amb, 8)}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, width: 30, fontFamily: MONO, fontWeight: 700 }}>{String(m.obras.length)}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, width: 72, fontFamily: MONO, fontWeight: 700, color: C.mut }}>{K(m.valor)}</div>
                    </div>
                  ))
                : vazio('Nenhuma obra parada hoje.')}
            </div>
          </div>
          <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
            {cardH('Atrasadas e remarcadas', `${a.emCampo} obras em andamento (em execução ou paradas) hoje`)}
            <div style={col({ padding: '12px 13.5px' })}>
              {a.emCampo ? (
                <div style={col()}>
                  <div style={flex({ gap: 9, height: alturaMini(MINI_AT) })}>
                    {mini({
                      rotulo: 'Atrasadas',
                      valor: `${N0(a.pctAtrasadas)}%`,
                      cor: C.verm,
                      n: `${a.atrasadas} de ${a.emCampo} obras passaram do fim previsto`,
                    })}
                    {mini({
                      rotulo: 'Remarcadas',
                      valor: `${N0(a.pctRemarcadas)}%`,
                      cor: C.amb,
                      n: `${a.remarcadas} de ${a.emCampo} tiveram remarcação`,
                    })}
                  </div>
                  <div style={flex({ marginTop: 12, height: 15, borderRadius: 99, background: C.trilho })}>
                    {a.categorias
                      .filter((c) => c.obras.length)
                      .map((c, i, a) => (
                        <div key={c.k} style={{ flex: c.obras.length, minWidth: 3, height: 15, background: c.cor, borderRadius: `${i === 0 ? 99 : 0}px ${i === a.length - 1 ? 99 : 0}px ${i === a.length - 1 ? 99 : 0}px ${i === 0 ? 99 : 0}px` }} />
                      ))}
                  </div>
                  <div style={flex({ marginTop: 9, height: CHIPS_H, flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' })}>
                    {a.categorias.map((c) => (
                      <div
                        key={c.k}
                        style={flex({
                          height: 21.5,
                          alignItems: 'center',
                          border: `1px solid ${C.borda}`,
                          background: C.trilho,
                          borderRadius: 99,
                          padding: '0 9px',
                          fontSize: 11.25,
                          color: C.mut,
                        })}
                      >
                        <div style={{ width: 7.5, height: 7.5, borderRadius: 99, background: c.cor, marginRight: 5 }} />
                        <span>{`${c.nome} · ${c.obras.length}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                vazio('Nenhuma obra em andamento hoje.')
              )}
            </div>
          </div>
        </div>
      ),
    }
  )
}

const MINI_RITMO_E: Pick<Mini, 'n' | 'm' | 'linhasM'> = { n: '', m: '', linhasM: 2 }
const RITMO_H = 2 + CARDH + 12 + alturaMini(MINI_RITMO_E) + 12
function ritmo(painel: Painel): Bloco {
  const r = painel.ritmo
  const m = (rotulo: string, valor: string | number, cor: string | undefined, n: string, mm?: string) =>
    mini({ rotulo, valor: String(valor), cor, n, m: mm, linhasM: 2, padX: 7.5 })
  return secao('Ritmo do campo e respostas', 'Diário e tarefas mostram o que aconteceu e o que continua esperando alguém.', 1, 'Sempre hoje', {
    h: RITMO_H,
    el: (
      <div style={flex({ gap: 12, height: RITMO_H })}>
        <div style={{ ...CARD, flex: 1.3, minWidth: 0 }}>
          {cardH('Diário de hoje', 'Somente obras que entram na fila do diário')}
          <div style={flex({ padding: '12px 13.5px', gap: 7.5, height: RITMO_H - 2 - CARDH })}>
            {m('Responderam', `${r.responderam}/${r.esperados}`, undefined, 'registros esperados', `${Math.max(0, r.esperados - r.responderam)} ainda aguardam resposta`)}
            {m('Não andou', r.naoAndou, C.amb, 'registros de hoje', 'motivo e responsável visíveis')}
            {m('Com foto', r.comFoto, C.verde, 'registros de hoje', 'foto é evidência, não % de avanço')}
          </div>
        </div>
        <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
          {cardH('Tarefas', 'Tarefas das obras do filtro')}
          <div style={flex({ padding: '12px 13.5px', gap: 7.5, height: RITMO_H - 2 - CARDH, alignItems: 'flex-start' })}>
            {m('Abertas', r.abertas, undefined, 'aguardando resposta')}
            {m('Vencidas', r.vencidas, C.verm, 'prazo já passou')}
            {m('Respondidas', r.respondidas7, C.verde, 'nos últimos 7 dias')}
          </div>
        </div>
      </div>
    ),
  })
}

// Cronograma: rótulo 188 px, linha 38, cabeçalho 35.
const G_ROT = 188
const G_LIN = 38
const G_CAB = 35
/** Largura da linha do tempo: útil − borda do cartão − padding − borda da caixa − rótulo. */
const G_TL = W - 2 - 27 - 2 - G_ROT

function cronograma(painel: Painel): Bloco {
  const { linhas: todas, semDatas, janela } = painel.cronograma
  const linhas = recorteDoCronograma(todas)
  const hoje = painel.hoje
  const dias = (diasDesde(janela.de, janela.ate) ?? 0) + 1
  const pxd = G_TL / dias
  const x = (iso: string) => Math.max(0, Math.min(dias, diasDesde(janela.de, iso) ?? 0)) * pxd
  const xHoje = x(hoje)

  const ticks: { left: number; texto: string; mes: boolean }[] = []
  for (let n = 0; n < dias; n++) {
    const iso = somaDias(janela.de, n)!
    const d = new Date(iso + 'T00:00:00Z')
    if (d.getUTCDate() === 1) ticks.push({ left: n * pxd, texto: MESES_CURTOS[d.getUTCMonth()], mes: true })
    else if (d.getUTCDay() === 1) ticks.push({ left: n * pxd, texto: fd(iso), mes: false })
  }
  const grade = (comTexto: boolean) =>
    ticks.map((t) => (
      <div
        key={t.left}
        style={flex({
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: t.left,
          width: 1,
          background: t.mes ? C.borda2 : 'rgba(30,58,95,.55)',
        })}
      >
        {comTexto && t.left < G_TL - 36 ? (
          <span
            style={{
              position: 'absolute',
              left: 4,
              top: t.mes ? 16.5 : 3,
              whiteSpace: 'nowrap',
              fontFamily: MONO,
              fontSize: 10.5,
              lineHeight: '13px',
              fontWeight: t.mes ? 700 : 400,
              color: t.mes ? C.txt : C.mut,
            }}
          >
            {t.texto}
          </span>
        ) : null}
      </div>
    ))
  const linhaHoje = <div style={{ position: 'absolute', top: 0, bottom: 0, left: xHoje, width: 2, background: C.lar }} />

  const linhaDaObra = (l: (typeof linhas)[number]) => {
    const o = l.obra
    const corReal = l.parada
      ? 'repeating-linear-gradient(45deg,#f4b73f 0px,#f4b73f 4px,#b4841f 4px,#b4841f 8px)'
      : l.atrasada
        ? C.verm
        : l.terminouComAtraso
          ? '#8a4a5c'
          : C.azul
    const fimBarras = [l.planFim, l.realFim].filter((d): d is string => !!d).sort().at(-1)
    const terminou = !l.atrasada && !!l.terminouComAtraso
    const est = (l.atrasada ? 80 : 0) + (terminou ? 88 : 0) + (l.remarcada ? 70 : 0) + o.etapaNome.length * 5.6
    const xTexto = Math.max(0, Math.min(G_TL - est - 4, (fimBarras ? x(fimBarras) : 0) + 5))
    return (
      <div key={o.id} style={flex({ height: G_LIN, borderTop: '1px solid rgba(30,58,95,.6)' })}>
        <div
          style={col({
            position: 'relative',
            width: G_ROT,
            flexShrink: 0,
            borderRight: `1px solid ${C.borda}`,
            background: C.card,
            padding: '3px 9px',
            justifyContent: 'center',
          })}
        >
          {l.atrasada ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.verm }} /> : null}
          <div style={linha(12.75, 16, { color: C.txt, fontWeight: 700 })}>{cortar(o.loja ?? 'sem loja', 24)}</div>
          <div style={linha(10.5, 14, { color: C.mut2 })}>{cortar(`${o.os ?? 'sem OS'} · ${o.equipe} · ${o.cliente}`, 32)}</div>
        </div>
        <div style={flex({ position: 'relative', width: G_TL, flexShrink: 0 })}>
          {grade(false)}
          {linhaHoje}
          {l.planIni && l.planFim ? (
            <div
              style={{
                position: 'absolute',
                top: 6,
                height: 10,
                left: x(l.planIni),
                width: Math.max(3, x(l.planFim) - x(l.planIni)),
                border: '1.5px dashed #7f95b5',
                borderRadius: 3,
                background: 'rgba(127,149,181,.08)',
              }}
            />
          ) : null}
          {l.realIni && l.realFim ? (
            <div
              style={{
                position: 'absolute',
                top: 20,
                height: 10.5,
                left: x(l.realIni),
                width: Math.max(3, x(somaDias(l.realFim, 1)!) - x(l.realIni)),
                borderRadius: 3,
                ...(corReal.startsWith('#') ? { backgroundColor: corReal } : { backgroundImage: corReal }),
              }}
            />
          ) : null}
          <div style={flex({ position: 'absolute', top: 11, left: xTexto, alignItems: 'center', gap: 4, whiteSpace: 'nowrap' })}>
            {l.atrasada ? tag(C.verm, `atrasada ${l.diasAtraso}d`) : null}
            {terminou ? (
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.mut2 }}>{`terminou +${l.terminouComAtraso}d ·`}</span>
            ) : null}
            {l.remarcada ? tag(C.amb, 'remarcada') : null}
            <span style={{ fontSize: 10.5, lineHeight: '14px', color: C.mut2 }}>{o.etapaNome}</span>
          </div>
        </div>
      </div>
    )
  }

  const caixaH = 2 + G_CAB + linhas.length * G_LIN
  const LEG_H = 9 + 15
  const MOSTRANDO_H = 6 + 15
  const SEMDATAS_H = semDatas ? 4 + 15 : 0
  const miolo = linhas.length ? caixaH + LEG_H + MOSTRANDO_H : VAZIO_H
  const h = 2 + 12 + miolo + SEMDATAS_H + 12

  const leg = (fundo: CSSProperties, t: string, largura = 16.5) => (
    <div key={t} style={flex({ alignItems: 'center' })}>
      <div style={{ width: largura, height: 8, borderRadius: 2, marginRight: 5, ...fundo }} />
      <span>{t}</span>
    </div>
  )
  const fraseSemDatas = semDatas
    ? `${semDatas} ${semDatas === 1 ? 'obra ficou' : 'obras ficaram'} fora do cronograma por não ter início planejado nem início real na ficha.`
    : ''

  return secao(
    'Cronograma obra a obra',
    'Recorte: as obras mais críticas (atrasadas, paradas e as próximas a iniciar). Planejado em cima, realizado embaixo; linha laranja = hoje.',
    2,
    posicaoHoje(painel),
    {
      h,
      el: (
        <div style={{ ...CARD, height: h }}>
          <div style={col({ padding: '12px 13.5px' })}>
            {linhas.length ? (
              <div style={col()}>
                <div style={col({ height: caixaH, border: `1px solid ${C.borda}`, borderRadius: 7.5 })}>
                  <div style={flex({ height: G_CAB, background: C.navy, borderRadius: '6.5px 6.5px 0 0' })}>
                    <div
                      style={flex({
                        width: G_ROT,
                        flexShrink: 0,
                        alignItems: 'center',
                        padding: '0 9px',
                        borderRight: `1px solid ${C.borda}`,
                        fontSize: 10.5,
                        color: C.mut,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                      })}
                    >
                      {`Obra · ${linhas.length}`}
                    </div>
                    <div style={flex({ position: 'relative', width: G_TL, flexShrink: 0 })}>
                      {grade(true)}
                      <div style={flex({ position: 'absolute', top: 0, bottom: 0, left: xHoje, width: 2, background: C.lar })} />
                      <div
                        style={flex({
                          position: 'absolute',
                          top: 0,
                          left: Math.max(0, Math.min(G_TL - 66, xHoje - 33)),
                          width: 66,
                          height: 15,
                          justifyContent: 'center',
                          alignItems: 'center',
                          background: C.lar,
                          color: '#fff',
                          fontSize: 9.75,
                          fontWeight: 700,
                          borderRadius: 3,
                        })}
                      >
                        {`hoje ${fd(hoje)}`}
                      </div>
                    </div>
                  </div>
                  {linhas.map(linhaDaObra)}
                </div>
                <div style={flex({ marginTop: 9, height: 15, gap: 13.5, fontSize: 11.25, lineHeight: '15px', color: C.mut })}>
                  {leg({ border: '1.5px dashed #7f95b5' }, 'Planejado')}
                  {leg({ background: C.azul }, 'Realizado')}
                  {leg({ background: C.verm }, 'Atrasada agora')}
                  {leg({ background: '#8a4a5c' }, 'Já terminou, com atraso')}
                  {leg({ backgroundImage: 'repeating-linear-gradient(45deg,#f4b73f 0px,#f4b73f 3px,#b4841f 3px,#b4841f 6px)' }, 'Parada agora')}
                  {leg({ background: C.lar }, 'Hoje', 3)}
                </div>
                <div style={linha(11.25, 15, { marginTop: 6, color: C.mut2 })}>
                  {`Mostrando ${linhas.length} de ${todas.length} obras no cronograma completo. As demais estão no hub.`}
                </div>
              </div>
            ) : (
              vazio('Nenhuma obra no cronograma hoje.')
            )}
            {semDatas ? <div style={linha(11.25, 15, { marginTop: 4, color: C.mut2 })}>{fraseSemDatas}</div> : null}
          </div>
        </div>
      ),
    }
  )
}

const kCurto = (v: number) => K(v).replace(' mil', 'k')
const H_GRAF = 143
const MINI_HIST: Pick<Mini, 'n' | 'extra'> = { n: '', extra: null }
const HIST_H = 2 + 12 + 4.5 + H_GRAF + 6 + 14 + 9 + 34 + 12 + alturaMini(MINI_HIST) + 12

function historico(painel: Painel): Bloco {
  const { historico: h, metas: mt, periodo: P, kpis } = painel
  const meses = h.meses
  const vals = meses.map((m) => m.valor)
  const topo = Math.max(...vals, mt.faturamento ?? 0) * 1.12 || 1
  const passoBruto = topo / 4
  const mag = Math.pow(10, Math.floor(Math.log10(passoBruto)))
  const passo = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= passoBruto) ?? passoBruto
  const ymax = passo * 4
  const selecionado = P.a.slice(0, 7)
  const rotMes = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`

  const barras = meses.map((m) => {
    if (m.semDado) {
      return (
        <div key={m.mes} style={col({ flex: 1, height: H_GRAF, alignItems: 'center', justifyContent: 'flex-end' })}>
          <span style={{ fontSize: 9.75, lineHeight: '12px', color: C.mut2, marginBottom: 2 }}>sem dado</span>
          <div
            style={{
              width: '78%',
              maxWidth: 42,
              height: H_GRAF * 0.18,
              border: `1px dashed ${C.borda2}`,
              borderBottomWidth: 0,
              borderRadius: '4.5px 4.5px 0 0',
            }}
          />
        </div>
      )
    }
    const abaixo = !!mt.faturamento && m.valor < mt.faturamento && !m.parcial
    const fundo = m.parcial
      ? 'repeating-linear-gradient(45deg,#f05a28 0px,#f05a28 4.5px,#c4461d 4.5px,#c4461d 9px)'
      : abaixo
        ? 'linear-gradient(180deg,#8a9bb5,#5c6f8d)'
        : 'linear-gradient(180deg,#ff7849,#f05a28)'
    const sel = m.mes === selecionado
    return (
      <div key={m.mes} style={col({ flex: 1, height: H_GRAF, alignItems: 'center', justifyContent: 'flex-end' })}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: '13px', color: C.mut, marginBottom: 2 }}>{kCurto(m.valor)}</span>
        <div
          style={{
            width: '78%',
            maxWidth: 42,
            height: Math.max(2, (m.valor / ymax) * H_GRAF),
            backgroundImage: fundo,
            borderRadius: '4.5px 4.5px 0 0',
            ...(sel ? { border: '2px solid #fff' } : {}),
          }}
        />
      </div>
    )
  })

  const leg = (fundo: CSSProperties | null, t: string) => (
    <div key={t} style={flex({ alignItems: 'center', height: 15 })}>
      {fundo ? <div style={{ width: 16.5, height: 8, borderRadius: 2, marginRight: 5, ...fundo }} /> : null}
      <span>{t}</span>
    </div>
  )
  const ano = kpis.faturadoAno
  const nMedia =
    h.fechados === 1 ? 'último mês fechado' : h.fechados ? `últimos ${h.fechados} meses fechados` : 'nenhum mês fechado desde o início do sistema'

  return secao(
    'Histórico de faturamento',
    'Faturado (NF emitida) mês a mês nos últimos 12 meses, com a linha da meta.',
    1,
    null,
    {
      h: HIST_H,
      el: (
        <div style={{ ...CARD, height: HIST_H }}>
          <div style={col({ padding: '12px 13.5px' })}>
            <div style={flex({ position: 'relative', marginLeft: 48, marginTop: 4.5, height: H_GRAF })}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={flex({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: (i * H_GRAF) / 4,
                    height: 0,
                    borderTop: '1px dashed rgba(30,58,95,.8)',
                  })}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: -45,
                      top: -7,
                      width: 39,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      fontFamily: MONO,
                      fontSize: 10.5,
                      lineHeight: '13px',
                      color: C.mut2,
                    }}
                  >
                    {kCurto(passo * i)}
                  </span>
                </div>
              ))}
              <div style={flex({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'flex-end', gap: 6 })}>
                {barras}
              </div>
              {mt.faturamento ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: (mt.faturamento / ymax) * H_GRAF,
                    height: 0,
                    borderTop: '2px dashed #fff',
                  }}
                />
              ) : null}
            </div>
            <div style={flex({ marginLeft: 48, marginTop: 6, height: 14, gap: 6 })}>
              {meses.map((m) => (
                <span key={m.mes} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, lineHeight: '14px', color: C.mut }}>
                  {rotMes(m.mes)}
                </span>
              ))}
            </div>
            <div style={flex({ marginTop: 9, height: 34, flexWrap: 'wrap', columnGap: 13.5, rowGap: 4, fontSize: 11.25, lineHeight: '15px', color: C.mut, alignContent: 'flex-start' })}>
              {leg({ background: C.lar }, 'Faturado no mês')}
              {leg({ background: '#6f82a0' }, 'Mês fechado abaixo da meta')}
              {leg({ backgroundImage: 'repeating-linear-gradient(45deg,#f05a28 0px,#f05a28 3px,#c4461d 3px,#c4461d 6px)' }, 'Mês em curso (parcial)')}
              {mt.faturamento
                ? leg({ height: 0, borderTop: '2px dashed #fff', borderRadius: 0 }, `Meta mensal ${R(mt.faturamento)}`)
                : leg(null, 'Sem meta para este filtro — obras pontuais')}
              {meses.some((m) => m.semDado)
                ? leg({ border: `1px dashed ${C.borda2}` }, `Sem dado: antes do sistema (começou em ${mesCurto(INICIO_DOS_DADOS)})`)
                : null}
            </div>
            <div style={flex({ marginTop: 12, gap: 12, height: alturaMini(MINI_HIST) })}>
              {mini({
                rotulo: `Acumulado ${P.ano} até ${MESES_CURTOS[P.mes - 1]}`,
                valor: R(ano.valor),
                n:
                  ano.metaAcumulada && ano.metaDesde
                    ? `meta acumulada desde ${mesCurto(ano.metaDesde)}: ${R(ano.metaAcumulada)} · ${N0((ano.valor / ano.metaAcumulada) * 100)}%`
                    : 'sem meta',
                extra: delta(ano.valor, ano.anterior, true, `vs mesmo período de ${P.ano - 1}`),
              })}
              {mini({ rotulo: 'Média mensal (meses fechados)', valor: R(h.mediaFechados), n: nMedia })}
              {mini({
                rotulo: 'Melhor mês',
                valor: R(h.melhor.valor),
                n: `${MESES_LONGOS[Number(h.melhor.mes.slice(5, 7)) - 1]} ${h.melhor.mes.slice(0, 4)}`,
              })}
            </div>
          </div>
        </div>
      ),
    }
  )
}

function rodape(lidoEm: string): Bloco {
  return {
    h: 22 + 1 + 10.5 + 16,
    el: (
      <div
        style={flex({
          marginTop: 22,
          height: 1 + 10.5 + 16,
          borderTop: `1px solid ${C.borda}`,
          paddingTop: 10.5,
          justifyContent: 'space-between',
          fontSize: 12,
          lineHeight: '16px',
          color: C.mut2,
        })}
      >
        <span>Hub Manfac · hub.manfac.com.br/obras/painel</span>
        <span>{`Dados lidos em ${lidoEm}`}</span>
      </div>
    ),
  }
}

function blocos(painel: Painel, lidoEm: string): Bloco[] {
  return [
    cabecalho(painel, lidoEm),
    faixaDosTotais(painel),
    metas(painel),
    resumo(painel),
    slas(painel),
    equipes(painel),
    paradasEAtrasos(painel),
    ritmo(painel),
    cronograma(painel),
    historico(painel),
    rodape(lidoEm),
  ].filter((b): b is Bloco => b !== null)
}

// ============================================================
// API
// ============================================================

/** Altura exata da imagem: margens + a soma das alturas fixas dos blocos. */
export function alturaDaImagem(painel: Painel): number {
  return Math.ceil(PAD_T + PAD_B + blocos(painel, '').reduce((s, b) => s + b.h, 0))
}

/** O painel inteiro, 900 px de largura. `lidoEm` já formatado (`formatarLidoEm`). */
export function ImagemDoPainel({ painel, lidoEm }: { painel: Painel; lidoEm: string }): ReactElement {
  return (
    <div
      style={col({
        width: LARGURA,
        height: alturaDaImagem(painel),
        background: C.fundo,
        color: C.txt,
        fontFamily: 'Inter',
        fontSize: 14,
        padding: `${PAD_T}px ${PAD_X}px ${PAD_B}px`,
      })}
    >
      {blocos(painel, lidoEm).map((b, i) => (
        <div key={i} style={col({ height: b.h, flexShrink: 0 })}>
          {b.el}
        </div>
      ))}
    </div>
  )
}

const PASTA_FONTES = join(process.cwd(), 'app/api/obras/relatorio-diario/_fontes')

/** As 3 fontes estáticas (OFL) versionadas em `_fontes/`. */
export async function carregarFontes() {
  const [regular, bold, mono] = await Promise.all(
    ['Inter-Regular.ttf', 'Inter-Bold.ttf', 'JetBrainsMono-Bold.ttf'].map((f) => readFile(join(PASTA_FONTES, f)))
  )
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: MONO, data: mono, weight: 700 as const, style: 'normal' as const },
  ]
}

/** Pixels por px de layout: o e-mail mostra a imagem a ~600 px, e a 1x ela borra com zoom ou em tela retina. */
export const ESCALA = 2

/** PNG do painel. Qualquer erro (inclusive dentro do stream) rejeita a promessa. */
export async function gerarPng(painel: Painel, lidoEm: string): Promise<Buffer> {
  const fonts = await carregarFontes()
  const altura = alturaDaImagem(painel)
  const res = new ImageResponse(
    (
      <div style={{ display: 'flex', width: LARGURA * ESCALA, height: altura * ESCALA }}>
        <div style={{ display: 'flex', width: LARGURA, height: altura, transform: `scale(${ESCALA})`, transformOrigin: 'top left', flexShrink: 0 }}>
          {ImagemDoPainel({ painel, lidoEm })}
        </div>
      </div>
    ),
    { width: LARGURA * ESCALA, height: altura * ESCALA, fonts }
  )
  return Buffer.from(await res.arrayBuffer())
}
