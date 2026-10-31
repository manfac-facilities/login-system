/**
 * PDF da ata de reunião (Leva 2 §3.1, decisão 2 do José: segue um modelo de
 * documento). Cabeçalho Manfac, participantes, pauta, registro, decisões
 * numeradas e pendências (o quê · responsável · prazo). Sem assinatura, sem
 * nenhum número de custo: só o que foi escrito na ata (§6.1-3).
 */
import { Document, Text, View } from '@react-pdf/renderer'
import { FUSO } from '../../_lib/tipos'
import { dataBr } from '../_lib/email-diario'
import { TEMA_OBRA as T } from '../_ui/tema'
import { CabecalhoManfac, PaginaManfac, Secao, TabelaSimples, estilos } from './base'

export type DadosPdfAta = {
  titulo: string
  campos: { rotulo: string; valor: string; mono?: boolean }[]
  participantes: string[]
  pauta: string
  texto: string | null
  decisoes: string[]
  pendencias: string[][]
  rodape: string
  logo: Buffer | null
}

const dataHora = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
    .format(new Date(ts))
    .replace(',', ' às')

/** Obra + registro de reunião → conteúdo do PDF. Puro (testável sem react-pdf). */
export function montarDadosPdfAta(p: {
  obra: { os: string | null; loja: string | null; descricao?: string | null; cliente: string | null; engenheiro_email: string | null }
  registro: {
    data: string
    participantes: string | null
    texto: string | null
    ata: { pauta?: string; decisoes?: string[]; pendencias?: { oque: string; responsavel: string; prazo: string | null }[] } | null
    criadoPor: string | null
    criadoEm: string
    editadoEm: string | null
  }
  geradoEm: string
  logo: Buffer | null
}): DadosPdfAta {
  const { obra, registro: r } = p
  const loja = obra.loja?.trim() || obra.descricao?.trim() || obra.os?.trim() || 'Obra'
  const ata = r.ata ?? {}
  return {
    titulo: `Ata de reunião · ${loja} · ${dataBr(r.data)}`,
    campos: [
      { rotulo: 'Obra', valor: loja },
      { rotulo: 'OS', valor: obra.os?.trim() || '—', mono: true },
      { rotulo: 'Cliente', valor: obra.cliente?.trim() || '—' },
      { rotulo: 'Data da reunião', valor: dataBr(r.data), mono: true },
      { rotulo: 'Engenheiro', valor: obra.engenheiro_email?.trim() || '—' },
      { rotulo: 'Registrada por', valor: r.criadoPor?.trim() || '—' },
    ],
    participantes: (r.participantes ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    pauta: ata.pauta?.trim() || '—',
    texto: r.texto?.trim() || null,
    decisoes: (ata.decisoes ?? []).map((d) => d.trim()).filter(Boolean),
    pendencias: (ata.pendencias ?? []).map((x, i) => [
      String(i + 1),
      x.oque,
      x.responsavel?.trim() || '—',
      x.prazo ? dataBr(x.prazo) : '—',
    ]),
    rodape:
      `Manfac Facilities · ata registrada em ${dataHora(r.criadoEm)}` +
      (r.editadoEm ? ` (editada em ${dataHora(r.editadoEm)})` : '') +
      ` · gerada em ${dataHora(p.geradoEm)}`,
    logo: p.logo,
  }
}

const vazio = (t: string) => <Text style={estilos.muted}>{t}</Text>

export function DocumentoAta({ d }: { d: DadosPdfAta }) {
  return (
    <Document title={d.titulo} author="Manfac Facilities" language="pt-BR">
      <PaginaManfac rodape={d.rodape}>
        <CabecalhoManfac logo={d.logo} documento="ATA DE REUNIÃO" titulo={d.titulo} campos={d.campos} />

        <Secao titulo="Participantes">
          {d.participantes.length
            ? d.participantes.map((x, i) => (
                <Text key={i} style={estilos.paragrafo}>
                  {x}
                </Text>
              ))
            : vazio('Não informados.')}
        </Secao>

        <Secao titulo="Pauta">
          <Text>{d.pauta}</Text>
        </Secao>

        {d.texto ? (
          <Secao titulo="Registro">
            <Text>{d.texto}</Text>
          </Secao>
        ) : null}

        <Secao titulo="Decisões">
          {d.decisoes.length
            ? d.decisoes.map((x, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 3 }}>
                  <Text style={[estilos.mono, { width: 18, color: T.orangeTexto, fontWeight: 700 }]}>{i + 1}.</Text>
                  <Text style={{ flex: 1 }}>{x}</Text>
                </View>
              ))
            : vazio('Nenhuma decisão registrada.')}
        </Secao>

        <Secao titulo="Pendências">
          {d.pendencias.length ? (
            <TabelaSimples
              colunas={[
                { titulo: '#', largura: 0.4, mono: true },
                { titulo: 'O QUÊ', largura: 5 },
                { titulo: 'RESPONSÁVEL', largura: 2.2 },
                { titulo: 'PRAZO', largura: 1.3, mono: true },
              ]}
              linhas={d.pendencias}
            />
          ) : (
            vazio('Nenhuma pendência.')
          )}
        </Secao>
      </PaginaManfac>
    </Document>
  )
}
