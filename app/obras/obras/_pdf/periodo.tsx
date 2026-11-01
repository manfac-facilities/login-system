/**
 * PDF do relatório de período (Leva 4 §2.1: mensal, fase, entrega). Só a
 * versão CLIENTE: o conteúdo vem de `montarConteudoPeriodo` com `lado:
 * 'cliente'` (o mesmo do e-mail) ou do congelado validado por esquema — sem R$,
 * sem impedimento oculto, sem área interna, sem `numero` (só o código exibido).
 */
import { Document, Image, Line, Polyline, Svg, Text, View } from '@react-pdf/renderer'
import { FUSO } from '../../_lib/tipos'
import type { ConteudoPeriodo, PontoCurva, TipoPeriodo } from '../_lib/relatorio-periodo'
import { TEMA_OBRA as T } from '../_ui/tema'
import { acaoTxt } from '../_lib/situacao'
import { CabecalhoManfac, Caixa, PaginaManfac, Secao, TabelaSimples, estilos } from './base'
import type { FotoSemanalPdf } from './semanal'

export type DadosPdfPeriodo = {
  conteudo: ConteudoPeriodo
  campos: { rotulo: string; valor: string; mono?: boolean }[]
  fotos: FotoSemanalPdf[]
  fotosOmitidas: number
  rodape: string
  logo: Buffer | null
}

const DOCUMENTO: Record<TipoPeriodo, string> = {
  mensal: 'RELATÓRIO MENSAL DE OBRA',
  fase: 'RELATÓRIO DE FASE DE OBRA',
  entrega: 'RELATÓRIO DE ENTREGA DE OBRA',
}

const dataHora = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
    .format(new Date(ts))
    .replace(',', ' às')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** Conteúdo (lado cliente) → dados do PDF. Puro. */
export function montarDadosPdfPeriodo(p: {
  conteudo: ConteudoPeriodo
  os: string | null
  cliente: string | null
  engenheiro: string | null
  validadoEm: string | null
  fotos: FotoSemanalPdf[]
  fotosOmitidas: number
  geradoEm: string
  logo: Buffer | null
}): DadosPdfPeriodo {
  const c = p.conteudo
  if (c.lado !== 'cliente') throw new Error('O PDF do relatório de período é sempre a versão do cliente')
  return {
    conteudo: c,
    campos: [
      { rotulo: 'Obra', valor: c.loja },
      { rotulo: 'OS', valor: p.os?.trim() || '—', mono: true },
      { rotulo: 'Cliente', valor: p.cliente?.trim() || '—' },
      { rotulo: 'Período', valor: `${dm(c.inicio)} a ${dm(c.fim)}`, mono: true },
      { rotulo: 'PPC médio', valor: c.ppc?.valor ?? '—', mono: true },
      { rotulo: 'Engenheiro', valor: p.engenheiro?.trim() || '—' },
    ],
    fotos: p.fotos,
    fotosOmitidas: p.fotosOmitidas,
    rodape: `Manfac Facilities · gerado em ${dataHora(p.geradoEm)}${p.validadoEm ? ` a partir do relatório validado em ${dataHora(p.validadoEm)}` : ''}`,
    logo: p.logo,
  }
}

const vazio = (t: string) => <Text style={estilos.muted}>{t}</Text>

const L = 500
const A = 120
/** Pontos "x,y" de uma série (fração 0–1; teto visual em 100%); null fica de fora. */
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
  const previsto = serie(curva, (p) => p.previsto)
  const realizado = serie(curva, (p) => p.realizado)
  return (
    <View wrap={false}>
      <Svg width={L} height={A + 2} viewBox={`0 -1 ${L} ${A + 2}`}>
        <Line x1={0} y1={A} x2={L} y2={A} stroke={T.border} strokeWidth={1} />
        <Line x1={0} y1={0} x2={L} y2={0} stroke={T.trilho} strokeWidth={1} />
        {base ? <Polyline points={base} stroke={T.base} strokeWidth={1.2} strokeDasharray="4 3" fill="none" /> : null}
        <Polyline points={previsto} stroke={T.ink} strokeWidth={1.5} fill="none" />
        {realizado ? <Polyline points={realizado} stroke={T.orange} strokeWidth={2} fill="none" /> : null}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={[estilos.mono, { fontSize: 7, color: T.mutedTexto }]}>{dm(curva[0].data)}</Text>
        <Text style={{ fontSize: 7, color: T.mutedTexto }}>
          {base ? 'base (tracejada) · ' : ''}previsto (azul) · realizado (laranja) · 0% a 100%
        </Text>
        <Text style={[estilos.mono, { fontSize: 7, color: T.mutedTexto }]}>{dm(curva[curva.length - 1].data)}</Text>
      </View>
    </View>
  )
}

export function DocumentoPeriodo({ d }: { d: DadosPdfPeriodo }) {
  const c = d.conteudo
  return (
    <Document title={c.assunto} author="Manfac Facilities" language="pt-BR">
      <PaginaManfac rodape={d.rodape}>
        <CabecalhoManfac logo={d.logo} documento={DOCUMENTO[c.tipo]} titulo={c.titulo} subtitulo={c.subtitulo} campos={d.campos} />

        <Secao titulo="Avanço e prazo">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.sinal.ponto, marginRight: 5 }} />
            <Text>
              <Text style={estilos.negrito}>{c.sinal.rotulo}</Text> — {c.avanco.desvio}.
            </Text>
          </View>
          <Text style={estilos.paragrafo}>
            Previsto até {c.avanco.ate}: <Text style={estilos.mono}>{c.avanco.previsto}</Text> · realizado:{' '}
            <Text style={estilos.mono}>{c.avanco.realizado}</Text>
          </Text>
          <Text style={estilos.paragrafo}>{c.previsao}</Text>
          <Text>
            {c.ppc
              ? `PPC médio do período: ${c.ppc.valor} (${c.ppc.semanas} ${c.ppc.semanas === 1 ? 'semana avaliada' : 'semanas avaliadas'})`
              : 'PPC médio do período: sem semana avaliada'}
          </Text>
        </Secao>

        {c.curva.length > 1 ? (
          <Secao titulo="Curva S">
            <CurvaS curva={c.curva} />
          </Secao>
        ) : null}

        {c.comparativo ? (
          <Secao titulo="Comparativo base × final">
            <Text style={estilos.paragrafo}>
              Término na base: <Text style={estilos.mono}>{c.comparativo.base ?? 'sem base'}</Text> · término final:{' '}
              <Text style={estilos.mono}>{c.comparativo.final}</Text>
            </Text>
            <Text>{c.comparativo.atraso}</Text>
          </Secao>
        ) : null}

        {c.highlights.length ? (
          <Secao titulo="Destaques do período">
            {c.highlights.map((h, i) => (
              <Caixa key={i} cor={T.orange}>
                {h}
              </Caixa>
            ))}
          </Secao>
        ) : null}

        {c.marcos.length ? (
          <Secao titulo="Marcos do período">
            <TabelaSimples
              colunas={[
                { titulo: 'Etapa', largura: 5 },
                { titulo: 'Base', largura: 2, mono: true },
                { titulo: 'Real', largura: 2, mono: true },
                { titulo: 'Desvio', largura: 3 },
              ]}
              linhas={c.marcos.map((m) => [m.etapa, m.base ?? '—', m.real, m.desvio ?? '—'])}
            />
          </Secao>
        ) : null}

        <Secao titulo="Concluídas no período">
          {c.concluidas.length ? (
            <TabelaSimples
              colunas={[{ titulo: 'Atividade', largura: 6 }, { titulo: 'Concluída em', largura: 2, mono: true }]}
              linhas={c.concluidas.map((a) => [a.descricao, a.fim])}
            />
          ) : (
            vazio('Nenhuma atividade concluída no período.')
          )}
        </Secao>

        <Secao titulo="Em andamento">
          {c.emAndamento.length ? (
            <TabelaSimples
              colunas={[
                { titulo: 'Atividade', largura: 6 },
                { titulo: '%', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Término previsto', largura: 2, mono: true },
              ]}
              linhas={c.emAndamento.map((a) => [a.descricao, a.percentual, a.termino])}
            />
          ) : (
            vazio('Nenhuma atividade em andamento.')
          )}
        </Secao>

        <Secao titulo="Dependem do cliente">
          {c.doCliente.length
            ? c.doCliente.map((r, i) => (
                <Caixa
                  key={i}
                  cor={r.vencida ? T.vermelho : T.yellow}
                  rotulo={`${r.tipo}${r.prazo ? ` · prazo ${r.prazo}${r.vencida ? ' (vencido)' : ''}` : ''}`}
                >
                  {r.descricao} — atividade {r.atividade}
                </Caixa>
              ))
            : vazio('Nada pendente com o cliente.')}
        </Secao>

        <Secao titulo="Impedimentos do período">
          {c.impedimentos.length
            ? c.impedimentos.map((it, i) => (
                <Caixa key={i} cor={T.vermelho} rotulo={it.rotulo}>
                  {it.corpo}
                </Caixa>
              ))
            : vazio('Nenhum impedimento no período.')}
        </Secao>

        {c.situacao ? (
          <Secao titulo="Situação da obra">
            <Text>{c.situacao.explicacao}</Text>
            {c.situacao.acoes.length ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontWeight: 700, color: T.ink, marginBottom: 2 }}>O que estamos fazendo para recuperar</Text>
                {c.situacao.acoes.map((a, i) => (
                  <Caixa key={i} cor={T.orange}>
                    {acaoTxt(a)}
                  </Caixa>
                ))}
              </View>
            ) : null}
            <Text style={[estilos.muted, { marginTop: 2 }]}>{`Atualizado em ${c.situacao.atualizadoEm} por ${c.situacao.por}`}</Text>
          </Secao>
        ) : null}

        <Secao titulo="Observações da engenharia">{c.observacoes ? <Text>{c.observacoes}</Text> : vazio('Sem observações.')}</Secao>

        {d.fotos.length || d.fotosOmitidas ? (
          <Secao titulo="Fotos do período" inteira>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {d.fotos.map((f, i) => (
                <View key={i} wrap={false} style={{ width: '25%', padding: 3 }}>
                  <Image src={{ data: f.dados, format: f.formato }} style={{ width: '100%', height: 95, objectFit: 'cover', borderRadius: 3 }} />
                  <Text style={{ fontSize: 7, color: T.mutedTexto, marginTop: 2 }}>
                    {`${f.data.slice(8, 10)}/${f.data.slice(5, 7)}`}
                    {f.legenda ? ` · ${f.legenda}` : ''}
                  </Text>
                </View>
              ))}
            </View>
            {d.fotosOmitidas ? (
              <Text style={[estilos.muted, { fontSize: 7.5, marginTop: 3 }]}>
                {d.fotosOmitidas} {d.fotosOmitidas === 1 ? 'foto omitida' : 'fotos omitidas'} (grande demais ou indisponível)
              </Text>
            ) : null}
          </Secao>
        ) : null}
      </PaginaManfac>
    </Document>
  )
}
