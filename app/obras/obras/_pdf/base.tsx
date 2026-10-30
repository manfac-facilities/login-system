/**
 * Peças base dos PDFs da OBRA (`@react-pdf/renderer`, só no servidor, runtime
 * Node): página A4 com rodapé fixo, cabeçalho Manfac, bloco de seção e tabela
 * simples. Usadas pelo RDO (`rdo.tsx`) e pela ata de reunião (Leva 2, Task 5).
 *
 * Identidade: cores de `_ui/tema.ts`, Inter (texto) e IBM Plex Mono (números e
 * datas), logo `public/logo.png`.
 *
 * Fontes (`./fontes`, todas SIL Open Font License 1.1 — textos em `OFL-*.txt`):
 * - Inter-Regular/Bold.ttf: Inter 4.001, cópia de `app/api/obras/relatorio-diario/_fontes`.
 * - IBMPlexMono-Regular/Bold.ttf: IBM Plex Mono 2.3, do repositório google/fonts
 *   (`ofl/ibmplexmono`, baixado em 30/10/2026; sha256 Regular 6a3412f0…, Bold ac27abd6…).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { TEMA_OBRA as T } from '../_ui/tema'

const PASTA_FONTES = join(process.cwd(), 'app/obras/obras/_pdf/fontes')

let fontesRegistradas = false
/** Registra Inter e IBM Plex Mono uma vez por processo. Chame antes de `renderToBuffer`. */
export function registrarFontes() {
  if (fontesRegistradas) return
  Font.register({
    family: 'Inter',
    fonts: [
      { src: join(PASTA_FONTES, 'Inter-Regular.ttf'), fontWeight: 400 },
      { src: join(PASTA_FONTES, 'Inter-Bold.ttf'), fontWeight: 700 },
    ],
  })
  Font.register({
    family: 'IBM Plex Mono',
    fonts: [
      { src: join(PASTA_FONTES, 'IBMPlexMono-Regular.ttf'), fontWeight: 400 },
      { src: join(PASTA_FONTES, 'IBMPlexMono-Bold.ttf'), fontWeight: 700 },
    ],
  })
  // Sem hifenização (a padrão é do inglês): palavra inteira quebra para a linha de baixo.
  Font.registerHyphenationCallback((palavra) => [palavra])
  fontesRegistradas = true
}

let logo: Buffer | null = null
/** `public/logo.png` (835×228), lido uma vez. */
export function logoManfac(): Buffer {
  logo ??= readFileSync(join(process.cwd(), 'public/logo.png'))
  return logo
}

export const estilos = StyleSheet.create({
  pagina: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: T.text,
    backgroundColor: T.card,
    paddingTop: 32,
    paddingHorizontal: 36,
    paddingBottom: 56,
    // Sem lineHeight na página: herdado pelo texto dinâmico (`render`) do rodapé, faz o número da página sumir.
  },
  mono: { fontFamily: 'IBM Plex Mono' },
  muted: { color: T.mutedTexto },
  negrito: { fontWeight: 700 },
  paragrafo: { marginBottom: 3 },
})

/** Página A4 retrato com o rodapé Manfac fixo em todas as folhas (texto + "página X de Y"). */
export function PaginaManfac({ rodape, children }: { rodape: string; children: ReactNode }) {
  return (
    <Page size="A4" style={estilos.pagina}>
      {children}
      <View fixed style={{ position: 'absolute', left: 36, right: 36, bottom: 38, borderTopWidth: 0.75, borderTopColor: T.border }} />
      <Text fixed style={{ position: 'absolute', left: 36, right: 150, bottom: 22, fontSize: 7.5, color: T.mutedTexto }}>
        {rodape}
      </Text>
      <Text
        fixed
        style={[estilos.mono, { position: 'absolute', left: 440, right: 36, bottom: 22, fontSize: 7.5, color: T.mutedTexto, textAlign: 'right' }]}
        render={({ pageNumber, totalPages }) => `página ${pageNumber} de ${totalPages}`}
      />
    </Page>
  )
}

/**
 * Cabeçalho Manfac: logo + rótulo do documento à esquerda, título e subtítulo,
 * faixa laranja e a grade de campos (rótulo pequeno em cima, valor embaixo).
 */
export function CabecalhoManfac({
  logo,
  documento,
  titulo,
  subtitulo,
  campos,
}: {
  logo: Buffer | null
  /** Ex.: "RELATÓRIO DIÁRIO DE OBRA". */
  documento: string
  titulo: string
  subtitulo?: string
  campos: { rotulo: string; valor: string; mono?: boolean }[]
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {logo ? <Image src={logo} style={{ width: 110, height: 30 }} /> : <Text style={estilos.negrito}>Manfac</Text>}
        <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: T.orangeTexto }}>{documento}</Text>
      </View>
      <Text style={{ fontSize: 16, lineHeight: 1.25, fontWeight: 700, color: T.ink, marginTop: 12 }}>{titulo}</Text>
      {subtitulo ? <Text style={{ fontSize: 9.5, color: T.mutedTexto, marginTop: 3 }}>{subtitulo}</Text> : null}
      <View style={{ height: 2.5, backgroundColor: T.orange, marginTop: 8, marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: T.surface, borderRadius: 4, padding: 6 }}>
        {campos.map((c) => (
          <View key={c.rotulo} style={{ width: '33.33%', padding: 4 }}>
            <Text style={{ fontSize: 7, color: T.mutedTexto, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {c.rotulo}
            </Text>
            <Text style={[{ fontSize: 9.5, color: T.ink, fontWeight: 700 }, c.mono ? estilos.mono : {}]}>{c.valor}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Bloco de seção: título em caixa alta (ink) com fio, e o conteúdo. Não deixa o título sozinho no fim da
 * folha; `inteira` não quebra a seção entre folhas (ex.: grade de fotos).
 */
export function Secao({ titulo, inteira, children }: { titulo: string; inteira?: boolean; children: ReactNode }) {
  return (
    <View wrap={!inteira} style={{ marginBottom: 12 }}>
      <View minPresenceAhead={40} wrap={false} style={{ borderBottomWidth: 0.75, borderBottomColor: T.border, marginBottom: 6, paddingBottom: 2 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {titulo}
        </Text>
      </View>
      {children}
    </View>
  )
}

export type ColunaTabela = { titulo: string; largura: number; alinhar?: 'left' | 'right' | 'center'; mono?: boolean }

/** Tabela simples: cabeçalho em fundo `surface`, linhas com fio fino; `largura` é a proporção (flex) da coluna. */
export function TabelaSimples({ colunas, linhas }: { colunas: ColunaTabela[]; linhas: string[][] }) {
  const celula = (c: ColunaTabela) => ({ flex: c.largura, paddingVertical: 3, paddingHorizontal: 4, textAlign: c.alinhar ?? 'left' })
  return (
    <View>
      <View style={{ flexDirection: 'row', backgroundColor: T.surface, borderBottomWidth: 0.75, borderBottomColor: T.border }}>
        {colunas.map((c) => (
          <Text key={c.titulo} style={[celula(c), { fontSize: 7.5, fontWeight: 700, color: T.mutedTexto }]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((l, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: T.trilho }}>
          {colunas.map((c, j) => (
            <Text key={c.titulo} style={[celula(c), c.mono ? estilos.mono : {}]}>
              {l[j] ?? ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/** Caixa de destaque com fio à esquerda (impedimento, orientação). */
export function Caixa({ cor, rotulo, children }: { cor: string; rotulo?: string; children: ReactNode }) {
  return (
    <View wrap={false} style={{ borderLeftWidth: 2.5, borderLeftColor: cor, backgroundColor: T.surface, paddingVertical: 4, paddingHorizontal: 7, marginBottom: 4 }}>
      {rotulo ? <Text style={{ fontSize: 7.5, fontWeight: 700, color: T.ink, marginBottom: 1 }}>{rotulo}</Text> : null}
      <Text>{children}</Text>
    </View>
  )
}
