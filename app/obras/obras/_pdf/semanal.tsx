/**
 * PDF do relatório semanal (Leva 3 §2.3). Só a versão CLIENTE: o conteúdo vem
 * de `montarConteudoSemanal` com `lado: 'cliente'`, o mesmo builder do e-mail —
 * sem R$, sem impedimento oculto, causa da Manfac só como "Manfac".
 */
import { Document, Image, Text, View } from '@react-pdf/renderer'
import { FUSO } from '../../_lib/tipos'
import type { ConteudoSemanal } from '../_lib/email-semanal'
import { TEMA_OBRA as T } from '../_ui/tema'
import { CabecalhoManfac, Caixa, PaginaManfac, Secao, TabelaSimples, estilos } from './base'
import type { FotoPdf } from './rdo'

export type FotoSemanalPdf = FotoPdf & { data: string }

export type DadosPdfSemanal = {
  conteudo: ConteudoSemanal
  campos: { rotulo: string; valor: string; mono?: boolean }[]
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

/** Conteúdo (lado cliente) → dados do PDF. Puro. */
export function montarDadosPdfSemanal(p: {
  conteudo: ConteudoSemanal
  os: string | null
  cliente: string | null
  engenheiro: string | null
  validadoEm: string | null
  fotos: FotoSemanalPdf[]
  fotosOmitidas: number
  geradoEm: string
  logo: Buffer | null
}): DadosPdfSemanal {
  const c = p.conteudo
  if (c.lado !== 'cliente') throw new Error('O PDF do semanal é sempre a versão do cliente')
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  return {
    conteudo: c,
    campos: [
      { rotulo: 'Obra', valor: c.loja },
      { rotulo: 'OS', valor: p.os?.trim() || '—', mono: true },
      { rotulo: 'Cliente', valor: p.cliente?.trim() || '—' },
      { rotulo: 'Semana', valor: `${dm(c.segunda)} a ${dm(c.sexta)}`, mono: true },
      { rotulo: 'PPC da semana', valor: c.ppc?.valor ?? '—', mono: true },
      { rotulo: 'Engenheiro', valor: p.engenheiro?.trim() || '—' },
    ],
    fotos: p.fotos,
    fotosOmitidas: p.fotosOmitidas,
    rodape: `Manfac Facilities · gerado em ${dataHora(p.geradoEm)}${p.validadoEm ? ` a partir do relatório validado em ${dataHora(p.validadoEm)}` : ''}`,
    logo: p.logo,
  }
}

const vazio = (t: string) => <Text style={estilos.muted}>{t}</Text>

export function DocumentoSemanal({ d }: { d: DadosPdfSemanal }) {
  const c = d.conteudo
  return (
    <Document title={c.assunto} author="Manfac Facilities" language="pt-BR">
      <PaginaManfac rodape={d.rodape}>
        <CabecalhoManfac logo={d.logo} documento="RELATÓRIO SEMANAL DE OBRA" titulo={c.titulo} subtitulo={c.subtitulo} campos={d.campos} />

        <Secao titulo="Avanço e prazo">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.sinal.ponto, marginRight: 5 }} />
            <Text>
              <Text style={estilos.negrito}>{c.sinal.rotulo}</Text> — {c.avanco.desvio}.
            </Text>
          </View>
          <Text style={estilos.paragrafo}>
            Previsto até a sexta: <Text style={estilos.mono}>{c.avanco.previsto}</Text> · realizado:{' '}
            <Text style={estilos.mono}>{c.avanco.realizado}</Text>
          </Text>
          <Text>{c.previsao}</Text>
        </Secao>

        <Secao titulo="Plano da semana (PPC)">
          {c.ppc ? (
            <Text style={estilos.paragrafo}>
              PPC <Text style={[estilos.mono, estilos.negrito]}>{c.ppc.valor}</Text> — {c.ppc.cumpridos} de {c.ppc.avaliados} itens
              avaliados cumpridos ({c.ppc.planejados} planejados)
            </Text>
          ) : (
            vazio('Sem plano fechado para esta semana.')
          )}
          {c.naoCumpridos.length ? (
            <TabelaSimples
              colunas={[
                { titulo: 'Não cumprido', largura: 5 },
                { titulo: 'Meta', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Chegou a', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Causa', largura: 2 },
                { titulo: 'Responsável', largura: 2 },
              ]}
              linhas={c.naoCumpridos.map((n) => [n.descricao, n.meta, n.final, n.causa ?? '—', n.responsavel ?? '—'])}
            />
          ) : null}
        </Secao>

        <Secao titulo="Concluídas na semana">
          {c.concluidas.length ? (
            <TabelaSimples
              colunas={[{ titulo: 'Atividade', largura: 6 }, { titulo: 'Concluída em', largura: 2, mono: true }]}
              linhas={c.concluidas.map((a) => [a.descricao, a.fim])}
            />
          ) : (
            vazio('Nenhuma atividade concluída na semana.')
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

        <Secao titulo="Programação da próxima semana">
          {c.proximaSemana === null ? (
            vazio('Plano da próxima semana ainda não fechado.')
          ) : c.proximaSemana.length ? (
            <TabelaSimples
              colunas={[{ titulo: 'Atividade', largura: 6 }, { titulo: 'Meta', largura: 1, alinhar: 'right', mono: true }]}
              linhas={c.proximaSemana.map((i) => [i.descricao, i.meta])}
            />
          ) : (
            vazio('Nenhuma atividade no plano.')
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

        <Secao titulo="Impedimentos da semana">
          {c.impedimentos.length
            ? c.impedimentos.map((it, i) => (
                <Caixa key={i} cor={T.vermelho} rotulo={it.rotulo}>
                  {it.corpo}
                </Caixa>
              ))
            : vazio('Nenhum impedimento na semana.')}
        </Secao>

        <Secao titulo="Observações da engenharia">{c.observacoes ? <Text>{c.observacoes}</Text> : vazio('Sem observações.')}</Secao>

        {d.fotos.length || d.fotosOmitidas ? (
          <Secao titulo="Fotos da semana" inteira>
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
