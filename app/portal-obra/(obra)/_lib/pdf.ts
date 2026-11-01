/**
 * PDF do portal do cliente (Leva 5 §3.2, "Abrir PDF"): só de documento ENVIADO
 * AO CLIENTE desta obra — o envio tem de estar na lista de `lerDocumentosEnviados`
 * (lado cliente, destinatário aceito, documento ainda validado/enviado). O PDF
 * sai dos MESMOS carregadores do hub (versão cliente; congelado quando houver;
 * fotos re-resolvidas pelos ids), lidos com o cliente admin e o id já autorizado.
 * Rascunho nunca: os carregadores recusam e a lista já filtra.
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarFontes } from '@/app/obras/obras/_pdf/base'
import { carregarPdfRdo } from '@/app/obras/obras/_pdf/carregar-rdo'
import { DocumentoRdo } from '@/app/obras/obras/_pdf/rdo'
import { carregarPdfAta, renderizarAta } from '@/app/obras/obras/_pdf/carregar-ata'
import { carregarPdfSemanal, renderizarSemanal } from '@/app/obras/obras/_pdf/carregar-semanal'
import { carregarPdfPeriodo, renderizarPeriodo } from '@/app/obras/obras/_pdf/carregar-periodo'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { lerDocumentosEnviados } from './ler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PdfDoPortal = { ok: true; pdf: Buffer; nomeArquivo: string } | { ok: false; status: 404 | 500 }

export async function pdfDoEnvio(admin: Admin, obraId: string, og: ObraGrande, envioId: string, hoje: string): Promise<PdfDoPortal> {
  if (!UUID.test(envioId)) return { ok: false, status: 404 }
  const lidos = await lerDocumentosEnviados(admin, obraId, og)
  if (!lidos.ok) return { ok: false, status: 500 }
  const doc = lidos.documentos.find((d) => d.envioId === envioId)
  if (!doc) return { ok: false, status: 404 }
  const a = doc.alvo
  const sb = admin as unknown as SupabaseClient

  if (a.tipo === 'diario') {
    const r = await carregarPdfRdo(sb, obraId, a.data)
    if (!r.ok) return { ok: false, status: r.status }
    registrarFontes()
    const pdf = await renderToBuffer(createElement(DocumentoRdo, { d: r.dados }) as Parameters<typeof renderToBuffer>[0])
    return { ok: true, pdf, nomeArquivo: r.nomeArquivo }
  }
  if (a.tipo === 'semanal') {
    const r = await carregarPdfSemanal(sb, obraId, a.segunda, hoje)
    if (!r.ok) return { ok: false, status: r.status }
    return { ok: true, pdf: await renderizarSemanal(r.dados), nomeArquivo: r.nomeArquivo }
  }
  if (a.tipo === 'periodo') {
    const r = await carregarPdfPeriodo(sb, obraId, a.tipoPeriodo, a.referencia, hoje)
    if (!r.ok) return { ok: false, status: r.status }
    return { ok: true, pdf: await renderizarPeriodo(r.dados), nomeArquivo: r.nomeArquivo }
  }
  const r = await carregarPdfAta(sb, obraId, a.registroId)
  if (!r.ok) return { ok: false, status: r.status }
  return { ok: true, pdf: await renderizarAta(r.dados), nomeArquivo: r.nomeArquivo }
}
