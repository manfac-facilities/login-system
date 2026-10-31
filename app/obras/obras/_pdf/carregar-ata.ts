/**
 * Lê a obra e o registro de reunião e devolve os dados do PDF da ata (Leva 2
 * §3.1). Usado pela rota GET (Baixar PDF) e pelo envio por e-mail (anexo).
 * Quem chama já conferiu sessão e acesso; as leituras usam o cliente da
 * sessão (RLS `obras` vale).
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logoManfac, registrarFontes } from './base'
import { DocumentoAta, montarDadosPdfAta, type DadosPdfAta } from './ata'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PdfAtaCarregado =
  | { ok: true; dados: DadosPdfAta; nomeArquivo: string; registro: Linha; obra: Linha }
  | { ok: false; status: 404 | 500; erro: string }

const nao = (erro: string): PdfAtaCarregado => ({ ok: false, status: 404, erro })

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'obra'

export async function carregarPdfAta(
  supabase: SupabaseClient,
  obraId: string,
  registroId: string,
  agora: Date = new Date(),
): Promise<PdfAtaCarregado> {
  if (!UUID.test(registroId)) return nao('Ata não encontrada')
  const [obraR, regR] = await Promise.all([
    supabase.from('obras_obra').select('id, os, loja, descricao, cliente, engenheiro_email, modalidade').eq('id', obraId).maybeSingle(),
    supabase.from('obras_registro').select('*').eq('id', registroId).eq('obra_id', obraId).maybeSingle(),
  ])
  if (obraR.error || regR.error) return { ok: false, status: 500, erro: 'Não foi possível ler a ata' }
  const obra = obraR.data as Linha | null
  const r = regR.data as Linha | null
  if (!obra || obra.modalidade !== 'obra') return nao('Obra não encontrada')
  if (!r || r.tipo !== 'reuniao') return nao('Ata não encontrada')

  let logo: Buffer | null = null
  try {
    logo = logoManfac()
  } catch {
    logo = null
  }
  const dados = montarDadosPdfAta({
    obra: {
      os: obra.os ?? null,
      loja: obra.loja ?? null,
      descricao: obra.descricao ?? null,
      cliente: obra.cliente ?? null,
      engenheiro_email: obra.engenheiro_email ?? null,
    },
    registro: {
      data: String(r.data),
      participantes: r.participantes ?? null,
      texto: r.texto ?? null,
      ata: r.ata ?? null,
      criadoPor: r.criado_por ?? null,
      criadoEm: String(r.criado_em),
      editadoEm: r.editado_em ?? null,
    },
    geradoEm: agora.toISOString(),
    logo,
  })
  const loja = String(obra.loja ?? obra.descricao ?? obra.os ?? 'obra')
  return { ok: true, dados, nomeArquivo: `ata-${slug(loja)}-${r.data}.pdf`, registro: r, obra }
}

export async function renderizarAta(d: DadosPdfAta): Promise<Buffer> {
  registrarFontes()
  return renderToBuffer(createElement(DocumentoAta, { d }) as Parameters<typeof renderToBuffer>[0])
}
