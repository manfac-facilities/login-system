/**
 * PDF do diário de obra (RDO) — spec Leva 2 §3.3 e §6.1-5. Só a versão
 * CLIENTE: o conteúdo vem de `montarConteudoDiario` com `lado: 'cliente'`, o
 * mesmo builder do e-mail — sem R$/peso, sem impedimento oculto, causa da
 * Manfac só como "Manfac". Sem assinatura.
 */
import { Document, Image, Text, View } from '@react-pdf/renderer'
import { FUSO } from '../../_lib/tipos'
import { dataBr, montarConteudoDiario, pct, type ConteudoDiario, type RdoCompleto } from '../_lib/email-diario'
import type { ObraGrande } from '../_lib/leitura'
import { TEMA_OBRA as T } from '../_ui/tema'
import { CabecalhoManfac, Caixa, PaginaManfac, Secao, TabelaSimples, estilos } from './base'

export type FotoPdf = { dados: Buffer; formato: 'jpg' | 'png'; legenda: string | null }

export type DadosPdfRdo = {
  conteudo: ConteudoDiario
  campos: { rotulo: string; valor: string; mono?: boolean }[]
  equipe: { efetivo: number | null; texto: string | null }
  fotos: FotoPdf[]
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

/** Dados → conteúdo do PDF, sempre do lado cliente. Puro (testável sem react-pdf). */
export function montarDadosPdfRdo(p: {
  obra: ObraGrande
  rdo: RdoCompleto
  equipe: { efetivo: number | null; texto: string | null }
  validadoPor: string
  validadoEm: string
  diaN: number
  fotos: FotoPdf[]
  fotosOmitidas: number
  geradoEm: string
  logo: Buffer | null
}): DadosPdfRdo {
  const conteudo = montarConteudoDiario({
    lado: 'cliente', obra: p.obra, rdo: p.rdo, validadoPor: p.validadoPor, validadoEm: p.validadoEm, diaN: p.diaN,
  })
  const { obra } = p.obra
  return {
    conteudo,
    campos: [
      { rotulo: 'Obra', valor: conteudo.loja },
      { rotulo: 'OS', valor: obra.os?.trim() || '—', mono: true },
      { rotulo: 'Cliente', valor: obra.cliente?.trim() || '—' },
      { rotulo: 'Data', valor: dataBr(p.rdo.data), mono: true },
      { rotulo: 'Dia da obra', valor: `dia ${p.diaN}`, mono: true },
      { rotulo: 'Engenheiro', valor: obra.engenheiro_email?.trim() || '—' },
    ],
    equipe: p.equipe,
    fotos: p.fotos,
    fotosOmitidas: p.fotosOmitidas,
    rodape: `Manfac Facilities · gerado em ${dataHora(p.geradoEm)} a partir do diário validado em ${dataHora(p.validadoEm)}`,
    logo: p.logo,
  }
}

const vazio = (t: string) => <Text style={estilos.muted}>{t}</Text>

export function DocumentoRdo({ d }: { d: DadosPdfRdo }) {
  const c = d.conteudo
  const equipe = [
    d.equipe.efetivo !== null ? `${d.equipe.efetivo} ${d.equipe.efetivo === 1 ? 'pessoa' : 'pessoas'}` : null,
    d.equipe.texto?.trim() || null,
  ].filter(Boolean)
  return (
    <Document title={c.assunto} author="Manfac Facilities" language="pt-BR">
      <PaginaManfac rodape={d.rodape}>
        <CabecalhoManfac
          logo={d.logo}
          documento="RELATÓRIO DIÁRIO DE OBRA"
          titulo={c.titulo}
          subtitulo={c.subtitulo}
          campos={d.campos}
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Secao titulo="Clima">
              {c.clima.length
                ? c.clima.map((t) => (
                    <View key={t.turno} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.cor, borderWidth: 0.5, borderColor: T.muted, marginRight: 5 }} />
                      <Text>
                        <Text style={estilos.negrito}>{t.turno}:</Text> {t.rotulo}
                      </Text>
                    </View>
                  ))
                : vazio('Não informado.')}
            </Secao>
          </View>
          <View style={{ flex: 2 }}>
            <Secao titulo="Equipe">{equipe.length ? <Text>{equipe.join(' · ')}</Text> : vazio('Não informada.')}</Secao>
          </View>
        </View>

        <Secao titulo="Serviços executados">
          {c.semExecucao ? (
            <Text>{c.semExecucao}</Text>
          ) : c.feitos.length ? (
            <TabelaSimples
              colunas={[
                { titulo: 'Atividade', largura: 6 },
                { titulo: 'De', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Para', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Situação', largura: 2 },
              ]}
              linhas={c.feitos.map((f) => [f.descricao, pct(f.de), pct(f.concluida ? 1 : f.para), f.concluida ? 'concluída' : 'em andamento'])}
            />
          ) : (
            vazio('Nenhuma atividade avançou hoje.')
          )}
        </Secao>

        {c.naoAvancou.length ? (
          <Secao titulo="Não avançou hoje">
            <TabelaSimples
              colunas={[
                { titulo: 'Atividade', largura: 5 },
                { titulo: '%', largura: 1, alinhar: 'right', mono: true },
                { titulo: 'Causa', largura: 2 },
                { titulo: 'Responsável', largura: 2 },
              ]}
              linhas={c.naoAvancou.map((a) => [a.descricao, pct(a.de), a.causa ?? '—', a.responsavel ?? '—'])}
            />
          </Secao>
        ) : null}

        <Secao titulo="Impedimentos abertos">
          {c.travados.length
            ? c.travados.map((it, i) => (
                <Caixa key={i} cor={it.tecnico ? T.yellow : T.vermelho} rotulo={it.rotulo}>
                  {it.corpo}
                </Caixa>
              ))
            : vazio('Nenhum impedimento aberto.')}
        </Secao>

        {c.orientacoes.length ? (
          <Secao titulo="Orientações à loja">
            {c.orientacoes.map((o, i) => (
              <Caixa key={i} cor={T.ink}>
                {o}
              </Caixa>
            ))}
          </Secao>
        ) : null}

        <Secao titulo="Programação de amanhã">
          <Text>{c.amanha}</Text>
        </Secao>

        {d.fotos.length || d.fotosOmitidas ? (
          <Secao titulo="Fotos do dia" inteira>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {d.fotos.map((f, i) => (
                <View key={i} wrap={false} style={{ width: '33.33%', padding: 3 }}>
                  <Image src={{ data: f.dados, format: f.formato }} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 3 }} />
                  {f.legenda ? <Text style={{ fontSize: 7.5, color: T.mutedTexto, marginTop: 2 }}>{f.legenda}</Text> : null}
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
