/**
 * PDF da apresentação ao cliente (Leva 4 §2.4): A4 paisagem, uma página por
 * bloco, o mesmo conteúdo da tela cheia. Só a versão CLIENTE (conteúdo de
 * `montarApresentacao`): sem R$, sem impedimento oculto, sem `numero`.
 */
import type { ReactNode } from 'react'
import { Document, Image, Line, Page, Polyline, Rect, Svg, Text, View } from '@react-pdf/renderer'
import { FUSO } from '../../_lib/tipos'
import { slidesDe, ROTULO_BLOCO, type BlocoId, type ConteudoApresentacao } from '../_lib/apresentacao'
import type { PontoCurva } from '../_lib/relatorio-periodo'
import { TEMA_OBRA as T } from '../_ui/tema'
import { Caixa, TabelaSimples, estilos } from './base'
import type { FotoSemanalPdf } from './semanal'

export type DadosPdfApresentacao = {
  conteudo: ConteudoApresentacao
  fotos: FotoSemanalPdf[]
  fotosOmitidas: number
  rodape: string
  logo: Buffer | null
}

const dataHora = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
    .format(new Date(ts))
    .replace(',', ' às')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const pc = (f: number) => `${Math.round(Number.isFinite(f) ? f * 100 : 0)}%`

export function montarDadosPdfApresentacao(p: {
  conteudo: ConteudoApresentacao
  fotos: FotoSemanalPdf[]
  fotosOmitidas: number
  geradoEm: string
  logo: Buffer | null
}): DadosPdfApresentacao {
  return {
    conteudo: p.conteudo,
    fotos: p.fotos,
    fotosOmitidas: p.fotosOmitidas,
    rodape: `Manfac Facilities · ${p.conteudo.loja} · gerado em ${dataHora(p.geradoEm)}`,
    logo: p.logo,
  }
}

const L = 700
const A = 230
function serie(curva: PontoCurva[], v: (p: PontoCurva) => number | null): string {
  const n = Math.max(curva.length - 1, 1)
  return curva
    .map((p, i) => [i, v(p)] as const)
    .filter((x): x is readonly [number, number] => x[1] !== null && Number.isFinite(x[1]))
    .map(([i, y]) => `${((i / n) * L).toFixed(1)},${(A - Math.min(Math.max(y, 0), 1) * A).toFixed(1)}`)
    .join(' ')
}

function CurvaS({ curva }: { curva: PontoCurva[] }) {
  const base = curva.some((p) => p.base !== null) ? serie(curva, (p) => p.base) : ''
  const realizado = serie(curva, (p) => p.realizado)
  return (
    <View wrap={false}>
      <Svg width={L} height={A + 2} viewBox={`0 -1 ${L} ${A + 2}`}>
        <Line x1={0} y1={A} x2={L} y2={A} stroke={T.border} strokeWidth={1} />
        <Line x1={0} y1={0} x2={L} y2={0} stroke={T.trilho} strokeWidth={1} />
        {base ? <Polyline points={base} stroke={T.base} strokeWidth={1.4} strokeDasharray="4 3" fill="none" /> : null}
        <Polyline points={serie(curva, (p) => p.previsto)} stroke={T.ink} strokeWidth={1.8} fill="none" />
        {realizado ? <Polyline points={realizado} stroke={T.orange} strokeWidth={2.4} fill="none" /> : null}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={[estilos.mono, { fontSize: 8, color: T.mutedTexto }]}>{dm(curva[0].data)}</Text>
        <Text style={{ fontSize: 8, color: T.mutedTexto }}>
          {base ? 'base (tracejada) · ' : ''}previsto (azul) · realizado (laranja) · 0% a 100%
        </Text>
        <Text style={[estilos.mono, { fontSize: 8, color: T.mutedTexto }]}>{dm(curva[curva.length - 1].data)}</Text>
      </View>
    </View>
  )
}

const LB = 380
function Barra({ valor, cor, tracejada }: { valor: number | null; cor: string; tracejada?: boolean }) {
  const w = Math.min(1, Math.max(0, valor ?? 0)) * LB
  return (
    <Svg width={LB} height={7} viewBox={`0 0 ${LB} 7`}>
      <Rect x={0} y={0} width={LB} height={7} fill={T.trilho} />
      {w > 0 ? <Rect x={0} y={0} width={w} height={7} fill={tracejada ? 'none' : cor} stroke={tracejada ? cor : undefined} strokeWidth={tracejada ? 1 : 0} /> : null}
    </Svg>
  )
}

const vazio = (t: string) => <Text style={estilos.muted}>{t}</Text>

function Pagina({ titulo, d, children }: { titulo: string; d: DadosPdfApresentacao; children: ReactNode }) {
  return (
    <Page size="A4" orientation="landscape" style={[estilos.pagina, { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 52 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        {d.logo ? <Image src={d.logo} style={{ width: 88, height: 24 }} /> : <Text style={estilos.negrito}>Manfac</Text>}
        <Text style={{ fontSize: 8, color: T.mutedTexto }}>{d.conteudo.loja}</Text>
      </View>
      <View style={{ height: 2.5, backgroundColor: T.orange, marginBottom: 10 }} />
      <Text style={{ fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 12 }}>{titulo}</Text>
      {children}
      <View fixed style={{ position: 'absolute', left: 40, right: 40, bottom: 34, borderTopWidth: 0.75, borderTopColor: T.border }} />
      <Text fixed style={{ position: 'absolute', left: 40, right: 200, bottom: 18, fontSize: 7.5, color: T.mutedTexto }}>
        {d.rodape}
      </Text>
      <Text
        fixed
        style={[estilos.mono, { position: 'absolute', left: 600, right: 40, bottom: 18, fontSize: 7.5, color: T.mutedTexto, textAlign: 'right' }]}
        render={({ pageNumber, totalPages }) => `página ${pageNumber} de ${totalPages}`}
      />
    </Page>
  )
}

function Capa({ d }: { d: DadosPdfApresentacao }) {
  const c = d.conteudo
  return (
    <Page size="A4" orientation="landscape" style={[estilos.pagina, { paddingHorizontal: 60, justifyContent: 'center' }]}>
      {d.logo ? <Image src={d.logo} style={{ width: 160, height: 44, marginBottom: 30 }} /> : null}
      <View style={{ height: 3, width: 90, backgroundColor: T.orange, marginBottom: 18 }} />
      <Text style={{ fontSize: 34, fontWeight: 700, color: T.ink }}>{c.titulo}</Text>
      {c.cliente ? <Text style={{ fontSize: 16, color: T.text, marginTop: 8 }}>{c.cliente}</Text> : null}
      <Text style={{ fontSize: 12, color: T.mutedTexto, marginTop: 14 }}>Apresentação de andamento da obra</Text>
      <Text style={{ fontSize: 12, color: T.mutedTexto, marginTop: 3 }}>{c.subtitulo}</Text>
    </Page>
  )
}

function Slide({ bloco, d }: { bloco: BlocoId; d: DadosPdfApresentacao }) {
  const c = d.conteudo
  const titulo = ROTULO_BLOCO[bloco]
  switch (bloco) {
    case 'capa':
      return <Capa d={d} />
    case 'resumo': {
      const r = c.resumo!
      return (
        <Pagina titulo={titulo} d={d}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: r.sinal.ponto, marginRight: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: 700 }}>{r.sinal.rotulo}</Text>
          </View>
          <Text style={{ fontSize: 13, marginBottom: 8 }}>{r.avanco.desvio}.</Text>
          <Text style={{ fontSize: 13, marginBottom: 8 }}>
            Previsto até {r.avanco.ate}: <Text style={estilos.mono}>{r.avanco.previsto}</Text> · realizado:{' '}
            <Text style={estilos.mono}>{r.avanco.realizado}</Text>
          </Text>
          <Text style={{ fontSize: 13 }}>{r.previsao}</Text>
        </Pagina>
      )
    }
    case 'curva':
      return (
        <Pagina titulo={titulo} d={d}>
          <CurvaS curva={c.curva!} />
        </Pagina>
      )
    case 'cronograma':
      return (
        <Pagina titulo={titulo} d={d}>
          {c.cronograma!.map((l, i) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
              <Text style={{ width: 190, fontSize: 10, fontWeight: 700 }}>{l.etapa}</Text>
              <View style={{ width: LB, marginRight: 10 }}>
                {l.base !== null ? <Barra valor={l.base} cor={T.base} tracejada /> : null}
                <Barra valor={l.previsto} cor={T.ink} />
                <Barra valor={l.realizado} cor={T.orange} />
              </View>
              <Text style={[estilos.mono, { fontSize: 8.5 }]}>
                {l.base !== null ? `base ${pc(l.base)} · ` : ''}prev. {pc(l.previsto)} · real. {pc(l.realizado)}
              </Text>
            </View>
          ))}
          <Text style={[estilos.muted, { fontSize: 8, marginTop: 4 }]}>Barras: base (tracejada), previsto (azul), realizado (laranja).</Text>
        </Pagina>
      )
    case 'marcos': {
      const m = c.marcos!
      return (
        <Pagina titulo={titulo} d={d}>
          {m.destaques.map((h, i) => (
            <Caixa key={i} cor={T.orange}>
              {h}
            </Caixa>
          ))}
          {m.marcos.length ? (
            <View style={{ marginTop: 8 }}>
              <TabelaSimples
                colunas={[
                  { titulo: 'Etapa', largura: 5 },
                  { titulo: 'Base', largura: 2, mono: true },
                  { titulo: 'Real', largura: 2, mono: true },
                  { titulo: 'Desvio', largura: 3 },
                ]}
                linhas={m.marcos.map((x) => [x.etapa, x.base ?? '—', x.real, x.desvio ?? '—'])}
              />
            </View>
          ) : null}
        </Pagina>
      )
    }
    case 'fotos':
      return (
        <Pagina titulo={titulo} d={d}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {d.fotos.map((f, i) => (
              <View key={i} wrap={false} style={{ width: '25%', padding: 4 }}>
                <Image src={{ data: f.dados, format: f.formato }} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 3 }} />
                <Text style={{ fontSize: 7.5, color: T.mutedTexto, marginTop: 2 }}>
                  {`${f.data.slice(8, 10)}/${f.data.slice(5, 7)}`}
                  {f.legenda ? ` · ${f.legenda}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </Pagina>
      )
    case 'impedimentos': {
      const im = c.impedimentos!
      return (
        <Pagina titulo={titulo} d={d}>
          <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Aguardando vocês</Text>
          {im.doCliente.length
            ? im.doCliente.map((r, i) => (
                <Caixa
                  key={i}
                  cor={r.vencida ? T.vermelho : T.yellow}
                  rotulo={`${r.tipo}${r.prazo ? ` · prazo ${r.prazo}${r.vencida ? ' (vencido)' : ''}` : ''}`}
                >
                  {r.descricao} — atividade {r.atividade}
                </Caixa>
              ))
            : vazio('Nada pendente com vocês.')}
          <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Impedimentos do período</Text>
          {im.impedimentos.length
            ? im.impedimentos.map((it, i) => (
                <Caixa key={i} cor={T.vermelho} rotulo={it.rotulo}>
                  {it.corpo}
                </Caixa>
              ))
            : vazio('Nenhum impedimento no período.')}
        </Pagina>
      )
    }
    case 'ppc':
      return (
        <Pagina titulo={titulo} d={d}>
          <Text style={[estilos.mono, { fontSize: 40, fontWeight: 700, color: T.ink }]}>{c.ppc!.valor}</Text>
          <Text style={{ fontSize: 12, marginTop: 4 }}>
            {c.ppc!.semanas} {c.ppc!.semanas === 1 ? 'semana avaliada' : 'semanas avaliadas'} no período
          </Text>
        </Pagina>
      )
    case 'proximos':
      return (
        <Pagina titulo={titulo} d={d}>
          {c.proximos!.map((s) => (
            <View key={s.semana} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 3 }}>Semana de {s.semana}</Text>
              <TabelaSimples
                colunas={[
                  { titulo: 'Código', largura: 1, mono: true },
                  { titulo: 'Atividade', largura: 7 },
                  { titulo: 'Início', largura: 1.3, mono: true },
                  { titulo: 'Término', largura: 1.3, mono: true },
                ]}
                linhas={s.itens.map((i) => [i.codigo, i.nome, i.inicio, i.termino])}
              />
            </View>
          ))}
        </Pagina>
      )
  }
}

export function DocumentoApresentacao({ d }: { d: DadosPdfApresentacao }) {
  const slides = slidesDe(d.conteudo, d.fotos.length > 0)
  return (
    <Document title={`Apresentação · ${d.conteudo.loja}`} author="Manfac Facilities" language="pt-BR">
      {slides.map((b) => (
        <Slide key={b} bloco={b} d={d} />
      ))}
    </Document>
  )
}
