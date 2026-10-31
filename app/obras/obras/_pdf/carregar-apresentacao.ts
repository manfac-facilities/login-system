/**
 * PDF da apresentação ao cliente: lê a apresentação pela sessão (RLS) e baixa
 * as fotos escolhidas (re-resolvidas, caminho conferido por regex estrita em
 * `fotos-periodo.ts` antes do único uso da service role).
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_FOTOS_APRESENTACAO, type ParamsApresentacao } from '../_lib/apresentacao'
import { lerApresentacao, type Falha } from '../_lib/ler-apresentacao'
import { logoManfac, registrarFontes } from './base'
import { baixarFotos, slug } from './fotos-periodo'
import { DocumentoApresentacao, montarDadosPdfApresentacao, type DadosPdfApresentacao } from './apresentacao'

export async function carregarPdfApresentacao(
  supabase: SupabaseClient,
  obraId: string,
  hoje: string,
  params: ParamsApresentacao,
  agora: Date = new Date(),
): Promise<{ ok: true; dados: DadosPdfApresentacao; nomeArquivo: string } | Falha> {
  const l = await lerApresentacao(supabase, obraId, hoje, params)
  if (!l.ok) return l
  const { og, conteudo, fotos: refs, fim } = l.dados
  const { fotos, omitidas } = await baixarFotos(String(og.obra.id), refs, MAX_FOTOS_APRESENTACAO, 'pdf-apresentacao')
  const dados = montarDadosPdfApresentacao({ conteudo, fotos, fotosOmitidas: omitidas, geradoEm: agora.toISOString(), logo: logoManfac() })
  return { ok: true, dados, nomeArquivo: `apresentacao-${slug(conteudo.loja)}-${fim}.pdf` }
}

export async function renderizarApresentacao(d: DadosPdfApresentacao): Promise<Buffer> {
  registrarFontes()
  return renderToBuffer(createElement(DocumentoApresentacao, { d }) as Parameters<typeof renderToBuffer>[0])
}
