/**
 * Prancha de faseamento A3 paisagem (Leva 6b §2 item 9), `@react-pdf/renderer`,
 * só no servidor. Planta à esquerda com as camadas em SVG por cima (mesma
 * proporção); à direita marca, título, legenda, regras, trava e carimbo.
 * Referência visual: mockup aprovado `obra-faseamento-6b.html` (`camada`, `legenda`, `renderSheet`).
 *
 * Coordenadas das camadas são relativas (0-1). O SVG usa viewBox de largura 1000
 * e altura 1000/proporção da planta, então traços e rótulos têm o mesmo tamanho
 * do mockup (viewBox 1000x700) qualquer que seja a planta.
 */
import { Circle, Document, G, Image, Page, Path, Polygon, Polyline, Rect, Svg, Text, View } from '@react-pdf/renderer'
import { estilos, logoManfac } from '../../../_pdf/base'
import { TEMA_OBRA as T } from '../../../_ui/tema'
import { TIPOS, legendaDe, type Camada, type Carimbo, type GrupoCamada, type Ponto, type TipoCamada } from './camadas'
import { dataBR } from './trava'

export type DadosPrancha = {
  obra: { nome: string; os: string }
  fase: { numero: number; nome: string }
  revisao: { revisao: number; emitidaEm: string | null }
  camadas: Camada[]
  regras: string[]
  carimbo: Carimbo
  travaTexto: string | null
  /** URL assinada (ou dados) da planta; com `planta` (dimensões) ou ambos nulos. */
  plantaUrl: string | null
  planta: { largura: number; altura: number } | null
}

const A3 = { w: 1190.55, h: 841.89 }
const MARGEM = 24
const COLUNA = 440
const GAP = 16
const U = 1000
const ORDEM: GrupoCamada[] = ['zona', 'linha', 'porta', 'fluxo', 'icone']
const GRUPO_DE = (t: TipoCamada) => TIPOS[t].grupo
const ESCURO = '#0d2050'

/** Linhas diagonais (45 graus, passo `passo`) recortadas ao retângulo: hachura da circulação restrita. */
function hachura(x: number, y: number, w: number, h: number, passo = 14) {
  const out: [number, number, number, number][] = []
  for (let c = x + y + passo; c < x + w + y + h; c += passo) {
    const x1 = Math.max(x, c - (y + h))
    const x2 = Math.min(x + w, c - y)
    if (x2 > x1) out.push([x1, c - x1, x2, c - x2])
  }
  return out
}

const pts = (p: Ponto[], V: number) => p.map(([x, y]) => `${(x * U).toFixed(1)},${(y * V).toFixed(1)}`).join(' ')

function seta(p: Ponto[], V: number, cor: string) {
  const [x1, y1] = p[p.length - 2]
  const [x2, y2] = p[p.length - 1]
  const a = Math.atan2((y2 - y1) * V, (x2 - x1) * U)
  const X = x2 * U
  const Y = y2 * V
  const L = 22
  const W = 9
  const bx = X - L * Math.cos(a)
  const by = Y - L * Math.sin(a)
  return (
    <Polygon
      points={`${X.toFixed(1)},${Y.toFixed(1)} ${(bx - W * Math.sin(a)).toFixed(1)},${(by + W * Math.cos(a)).toFixed(1)} ${(bx + W * Math.sin(a)).toFixed(1)},${(by - W * Math.cos(a)).toFixed(1)}`}
      fill={cor}
    />
  )
}

function Camada1({ c, V }: { c: Camada; V: number }) {
  const def = TIPOS[c.t]
  if ('r' in c) {
    const x = c.r[0] * U
    const y = c.r[1] * V
    const w = c.r[2] * U
    const h = c.r[3] * V
    const obra = c.t === 'zona_obra'
    return (
      <G>
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={def.cor}
          fillOpacity={c.t === 'restrita' ? 1 : 0.85}
          stroke={obra ? '#e0531f' : c.t === 'restrita' ? '#b42318' : '#9aa3b2'}
          strokeWidth={obra ? 2 : 1}
          strokeDasharray={obra ? '8 5' : undefined}
        />
        {c.t === 'restrita'
          ? hachura(x, y, w, h).map(([a, b, d, e], i) => (
              <Path key={i} d={`M${a.toFixed(1)} ${b.toFixed(1)} L${d.toFixed(1)} ${e.toFixed(1)}`} stroke="#b42318" strokeOpacity={0.45} strokeWidth={2} />
            ))
          : null}
        {c.rot ? (
          <Text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fill={ESCURO} fillOpacity={0.8} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: w < 200 ? 12 : 16 }}>
            {c.rot}
          </Text>
        ) : null}
      </G>
    )
  }
  if ('p' in c) {
    const g = GRUPO_DE(c.t)
    if (g === 'linha') {
      return (
        <Polyline
          points={pts(c.p, V)}
          fill="none"
          stroke={def.cor}
          strokeWidth={c.t === 'drywall' ? 9 : 12}
          strokeDasharray={c.t === 'balcao' ? '26 4' : undefined}
        />
      )
    }
    return (
      <G>
        <Polyline points={pts(c.p, V)} fill="none" stroke={def.cor} strokeWidth={4} strokeDasharray="14 8" />
        {seta(c.p, V, def.cor)}
      </G>
    )
  }
  const x = c.at[0] * U
  const y = c.at[1] * V
  if (GRUPO_DE(c.t) === 'porta') {
    return (
      <G>
        <Rect x={x - 10} y={y - 36} width={20} height={72} fill="#fff" stroke={def.cor} strokeWidth={5} />
        <Path d={`M${x - 8} ${y - 36} A72 72 0 0 0 ${x - 74} ${y + 30}`} fill="none" stroke={def.cor} strokeWidth={2} />
        <Path d={`M${x - 8} ${y - 36} L${x - 74} ${y + 30}`} stroke={def.cor} strokeWidth={2} />
        <Text x={x - 84} y={y + 56} textAnchor="end" fill={def.cor} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 12 }}>
          {c.t === 'porta_obra' ? 'NOVA PORTA · SÓ OBRA' : 'ENTRADA EXISTENTE'}
        </Text>
      </G>
    )
  }
  if (c.t === 'extintor') {
    return (
      <G>
        <Circle cx={x} cy={y} r={15} fill={def.cor} />
        <Rect x={x - 4} y={y - 8} width={8} height={16} fill="#fff" />
      </G>
    )
  }
  return (
    <G>
      <Rect x={x - 16} y={y - 11} width={32} height={22} rx={3} fill={def.cor} />
      <Path d={`M${x - 9} ${y} h18 M${x + 3} ${y - 6} l6 6 -6 6`} stroke="#fff" strokeWidth={3} fill="none" />
    </G>
  )
}

function Amostra({ t }: { t: TipoCamada }) {
  const d = TIPOS[t]
  const g = d.grupo
  return (
    <Svg width={26} height={14} viewBox="0 0 26 14">
      {g === 'zona' ? (
        <>
          <Rect x={0.5} y={0.5} width={25} height={13} fill={d.cor} stroke={t === 'zona_obra' ? '#e0531f' : t === 'restrita' ? '#b42318' : '#9aa3b2'} strokeWidth={1} strokeDasharray={t === 'zona_obra' ? '4 2' : undefined} />
          {t === 'restrita' ? <Path d="M0 14 L14 0 M10 14 L24 0" stroke="#b42318" strokeOpacity={0.5} strokeWidth={2} /> : null}
        </>
      ) : null}
      {g === 'linha' ? <Path d="M1 7 H25" stroke={d.cor} strokeWidth={t === 'drywall' ? 5 : 7} strokeDasharray={t === 'balcao' ? '9 2' : undefined} /> : null}
      {g === 'fluxo' ? (
        <>
          <Path d="M1 7 H20" stroke={d.cor} strokeWidth={2.5} strokeDasharray="5 3" />
          <Polygon points="19,3 25,7 19,11" fill={d.cor} />
        </>
      ) : null}
      {g === 'porta' ? <Rect x={10} y={0.5} width={6} height={13} fill="#fff" stroke={d.cor} strokeWidth={2.5} /> : null}
      {t === 'extintor' ? <Circle cx={13} cy={7} r={6.5} fill={d.cor} /> : null}
      {t === 'emerg' ? <Rect x={4} y={1} width={18} height={12} rx={2} fill={d.cor} /> : null}
    </Svg>
  )
}

const cab = { fontSize: 7.5, fontWeight: 700 as const, letterSpacing: 0.8, color: T.orangeTexto, textTransform: 'uppercase' as const, marginBottom: 3 }

function CelulaCarimbo({ rotulo, valor, cheia, mono }: { rotulo: string; valor: string; cheia?: boolean; mono?: boolean }) {
  return (
    <View style={{ width: cheia ? '100%' : '50%', padding: 4, borderTopWidth: 0.5, borderTopColor: T.border }}>
      <Text style={{ fontSize: 6.5, color: T.mutedTexto, textTransform: 'uppercase', letterSpacing: 0.4 }}>{rotulo}</Text>
      <Text style={[{ fontSize: 8, fontWeight: 700, color: T.ink, maxLines: 2, textOverflow: 'ellipsis' }, mono ? estilos.mono : {}]}>{valor || '—'}</Text>
    </View>
  )
}

/** Corpo das regras em degraus pelo volume de texto, para a coluna caber sempre em 1 página A3. */
export function fonteDasRegras(regras: readonly string[]): number {
  const total = regras.reduce((n, r) => n + r.length, 0)
  return total <= 900 ? 11.5 : total <= 1500 ? 10 : 9
}

export function PranchaFaseamento(d: DadosPrancha) {
  const fonteRegra = fonteDasRegras(d.regras)
  const prop = d.planta && d.planta.largura > 0 && d.planta.altura > 0 ? d.planta.largura / d.planta.altura : 1000 / 700
  const caixaW = A3.w - 2 * MARGEM - COLUNA - GAP
  const caixaH = A3.h - 2 * MARGEM
  let w = caixaW
  let h = w / prop
  if (h > caixaH) {
    h = caixaH
    w = h * prop
  }
  const V = U / prop
  const comPlanta = !!(d.plantaUrl && d.planta)
  const visiveis = d.camadas.filter((c) => !c.oculta)
  const camadas = [...visiveis].sort((a, b) => ORDEM.indexOf(GRUPO_DE(a.t)) - ORDEM.indexOf(GRUPO_DE(b.t)))
  const rascunho = d.revisao.emitidaEm == null
  const data = d.revisao.emitidaEm ? dataBR(d.revisao.emitidaEm) : '—'
  const rev = `R${d.revisao.revisao}`
  const logo = (() => {
    try {
      return logoManfac()
    } catch {
      return null
    }
  })()

  return (
    <Document title={`${d.carimbo.titulo || d.fase.nome} ${rev}`} author="Manfac">
      <Page size="A3" orientation="landscape" style={[estilos.pagina, { paddingTop: MARGEM, paddingBottom: MARGEM, paddingHorizontal: MARGEM, flexDirection: 'row' }]}>
        <View style={{ width: caixaW, height: caixaH, justifyContent: 'flex-start' }}>
          <View style={{ width: w, height: h, position: 'relative' }}>
            {comPlanta ? <Image src={d.plantaUrl as string} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, objectFit: 'fill' }} /> : null}
            <Svg width={w} height={h} viewBox={`0 0 ${U} ${V.toFixed(2)}`} style={{ position: 'absolute', left: 0, top: 0 }}>
              {!comPlanta ? <Rect x={0} y={0} width={U} height={V} fill="#fff" /> : null}
              {camadas.map((c) => (
                <Camada1 key={c.id} c={c} V={V} />
              ))}
              {/* Moldura desenhada por dentro do próprio Svg: não empurra a imagem nem as camadas. */}
              <Rect x={1} y={1} width={U - 2} height={V - 2} fill="none" stroke="#222" strokeWidth={2} />
            </Svg>
            {!comPlanta ? (
              <Text style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 8, color: T.mutedTexto }}>Sem planta enviada: camadas sobre quadro branco</Text>
            ) : (
              <Text style={[estilos.mono, { position: 'absolute', left: 8, bottom: 6, fontSize: 7, color: '#444', fontWeight: 700 }]}>
                {`BASE: ${(d.carimbo.base || 'PLANTA DO MAPA').toUpperCase()}`}
              </Text>
            )}
          </View>
        </View>

        <View style={{ width: COLUNA, marginLeft: GAP, minHeight: caixaH }}>
          {logo ? <Image src={logo} style={{ width: 110, height: 30 }} /> : <Text style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>MANFAC</Text>}
          <Text style={{ fontSize: 14, lineHeight: 1.25, fontWeight: 700, color: T.ink, marginTop: 6, maxLines: 3, textOverflow: 'ellipsis' }}>{d.carimbo.titulo || `Fase ${d.fase.numero} · ${d.fase.nome}`}</Text>
          <Text style={{ fontSize: 8.5, color: T.text, marginTop: 3 }}>{`${d.obra.nome} · OS ${d.obra.os}`}</Text>
          <View style={{ height: 2.5, backgroundColor: T.orange, marginVertical: 6 }} />

          <Text style={cab}>Legenda</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {legendaDe(visiveis).map((l) => (
              <View key={l.t} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', marginBottom: 1, paddingRight: 4 }}>
                <Amostra t={l.t} />
                <Text style={{ fontSize: 7, marginLeft: 5, flex: 1 }}>{l.nome}</Text>
              </View>
            ))}
          </View>

          <Text style={cab}>Regras</Text>
          <View style={{ marginBottom: 8 }}>
            {d.regras.map((r, i) => (
              <Text key={i} style={{ fontSize: fonteRegra, lineHeight: 1.2, marginBottom: 2 }}>{`${i + 1}. ${r}`}</Text>
            ))}
          </View>

          {d.travaTexto ? (
            <View style={{ borderWidth: 1, borderColor: '#b42318', padding: 5, marginBottom: 8 }}>
              <Text style={{ fontSize: 7.5, color: '#b42318', lineHeight: 1.2 }}>{d.travaTexto}</Text>
            </View>
          ) : null}

          <View style={{ flexGrow: 1 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: T.border }}>
            <CelulaCarimbo rotulo="Cliente" valor={d.carimbo.cliente} />
            <CelulaCarimbo rotulo="Obra" valor={`${d.obra.nome} · OS ${d.obra.os}`} />
            <CelulaCarimbo rotulo="Desenho" valor={d.carimbo.desenho} />
            <CelulaCarimbo rotulo="Base" valor={d.carimbo.base} />
            <CelulaCarimbo rotulo="Responsável técnico" valor={d.carimbo.rt} cheia />
            <CelulaCarimbo rotulo="Data" valor={data} mono />
            <CelulaCarimbo rotulo="Revisão" valor={rev} mono />
          </View>
        </View>

        {rascunho ? (
          <Text
            fixed
            style={{ position: 'absolute', left: 150, top: 330, fontSize: 130, fontWeight: 700, color: '#b42318', opacity: 0.14, transform: 'rotate(-25deg)' }}
          >
            RASCUNHO
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
