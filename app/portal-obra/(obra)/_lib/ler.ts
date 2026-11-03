/**
 * Leituras do portal do cliente (Leva 5 §3.2). Cliente admin, SEMPRE filtrado
 * pelo id de obra que a guarda (`exigirObra`) já autorizou.
 *
 * Documentos: só o que foi ENVIADO AO CLIENTE — linha de `obras_envio` com
 * `lado = 'cliente'` e ao menos um destinatário aceito — e cujo documento ainda
 * está validado/enviado (diário desfeito, relatório em rascunho ou ata apagada
 * somem). É a mesma lista que a rota do PDF consulta: o que não está aqui não
 * vira PDF no portal. Imediata não tem PDF.
 *
 * Galeria: fotos dos diários validados/enviados desta obra, caminho canônico
 * conferido (`caminhoFotoValido`), URL assinada curta (5 min).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { caminhoFotoValido } from '@/app/obras/obras/_pdf/fotos-periodo'
import { dataBr, hora } from '@/app/obras/obras/_lib/email-diario'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { etapasDaObra, ddmm, type TipoPeriodo } from '@/app/obras/obras/_lib/relatorio-periodo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type AlvoPdf =
  | { tipo: 'diario'; data: string }
  | { tipo: 'semanal'; segunda: string }
  | { tipo: 'periodo'; tipoPeriodo: TipoPeriodo; referencia: string }
  | { tipo: 'ata'; registroId: string }

export type DocumentoEnviado = {
  envioId: string
  grupo: 'diario' | 'relatorio' | 'ata'
  titulo: string
  /** "enviado em dd/mm/aaaa às hh:mm" */
  quando: string
  enviadoEm: string
  /** Só para a rota do PDF; nunca renderizado (a fase carrega o `numero` como referência). */
  alvo: AlvoPdf
}

const COM_PDF = new Set(['diario', 'semanal', 'mensal', 'fase', 'entrega', 'ata'])
const VALIDO = new Set(['validado', 'enviado'])
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const recebeu = (e: Linha) => Array.isArray(e.destinatarios) && e.destinatarios.some((d: unknown) => typeof d === 'string' && d.trim())
const ids = (linhas: Linha[], col: string) => [...new Set(linhas.map((e) => e[col]).filter((x): x is string => typeof x === 'string'))]

export async function lerDocumentosEnviados(
  admin: Admin,
  obraId: string,
  og: ObraGrande,
): Promise<{ ok: true; documentos: DocumentoEnviado[] } | { ok: false }> {
  const { data, error } = await admin
    .from('obras_envio')
    .select('id, obra_id, tipo, referencia, lado, enviado_em, destinatarios, rdo_id, registro_id, semanal_id, relatorio_id')
    .eq('obra_id', obraId)
    .eq('lado', 'cliente')
    .order('enviado_em', { ascending: false })
    .limit(500)
  if (error) return { ok: false }
  const envios = ((data ?? []) as Linha[]).filter((e) => e.obra_id === obraId && e.lado === 'cliente' && COM_PDF.has(e.tipo) && recebeu(e))

  const vazio = { data: [] as Linha[], error: null }
  const porIds = (tabela: string, cols: string, lista: string[]) =>
    lista.length ? admin.from(tabela).select(cols).eq('obra_id', obraId).in('id', lista) : Promise.resolve(vazio)
  const [rdoR, semR, relR, regR] = await Promise.all([
    porIds('obras_rdo', 'id, obra_id, data, estado', ids(envios.filter((e) => e.tipo === 'diario'), 'rdo_id')),
    porIds('obras_semanal', 'id, obra_id, semana_inicio, estado', ids(envios.filter((e) => e.tipo === 'semanal'), 'semanal_id')),
    porIds('obras_relatorio', 'id, obra_id, tipo, referencia, periodo_fim, estado', ids(envios, 'relatorio_id')),
    porIds('obras_registro', 'id, obra_id, tipo, data', ids(envios.filter((e) => e.tipo === 'ata'), 'registro_id')),
  ])
  if (rdoR.error || semR.error || relR.error || regR.error) return { ok: false }
  const mapa = (r: { data: unknown }) => new Map(((r.data ?? []) as Linha[]).filter((x) => x.obra_id === obraId).map((x) => [String(x.id), x]))
  const rdos = mapa(rdoR)
  const semanais = mapa(semR)
  const relatorios = mapa(relR)
  const registros = mapa(regR)
  const etapas = etapasDaObra(og)

  const vistos = new Set<string>()
  const documentos: DocumentoEnviado[] = []
  for (const e of envios) {
    let d: Omit<DocumentoEnviado, 'envioId' | 'quando' | 'enviadoEm'> | null = null
    let chave = ''
    if (e.tipo === 'diario') {
      const r = rdos.get(String(e.rdo_id))
      if (r && VALIDO.has(r.estado)) {
        chave = `rdo:${r.id}`
        d = { grupo: 'diario', titulo: `Diário de obra — ${dataBr(String(r.data))}`, alvo: { tipo: 'diario', data: String(r.data) } }
      }
    } else if (e.tipo === 'semanal') {
      const s = semanais.get(String(e.semanal_id))
      if (s && VALIDO.has(s.estado)) {
        chave = `sem:${s.id}`
        d = { grupo: 'relatorio', titulo: `Relatório semanal — semana de ${ddmm(String(s.semana_inicio))}`, alvo: { tipo: 'semanal', segunda: String(s.semana_inicio) } }
      }
    } else if (e.tipo === 'ata') {
      const g = registros.get(String(e.registro_id))
      if (g && g.tipo === 'reuniao') {
        chave = `ata:${g.id}`
        d = { grupo: 'ata', titulo: `Ata de reunião — ${dataBr(String(g.data))}`, alvo: { tipo: 'ata', registroId: String(g.id) } }
      }
    } else {
      const r = relatorios.get(String(e.relatorio_id))
      if (r && r.tipo === e.tipo && VALIDO.has(r.estado)) {
        chave = `rel:${r.id}`
        const ref = String(r.referencia)
        const titulo =
          r.tipo === 'mensal'
            ? `Relatório mensal — ${MESES[Number(ref.slice(5, 7)) - 1] ?? ''} de ${ref.slice(0, 4)}`
            : r.tipo === 'fase'
              ? (() => {
                  const et = etapas.find((x) => x.referencia === ref)
                  return et ? `Relatório de fase — etapa ${et.ordem}, ${et.nome}` : `Relatório de fase — concluída em ${dataBr(String(r.periodo_fim))}`
                })()
              : 'Relatório de entrega da obra'
        d = { grupo: 'relatorio', titulo, alvo: { tipo: 'periodo', tipoPeriodo: r.tipo, referencia: ref } }
      }
    }
    if (!d || vistos.has(chave)) continue
    vistos.add(chave)
    const em = String(e.enviado_em)
    documentos.push({ ...d, envioId: String(e.id), enviadoEm: em, quando: `enviado em ${dataBr(em.slice(0, 10))} às ${hora(em)}` })
  }
  return { ok: true, documentos }
}

// ---- Galeria -----------------------------------------------------------------

export type FotoGaleria = { id: string; url: string; legenda: string | null; data: string; dataIso: string; etapa: string }

export const MAX_FOTOS_GALERIA = 200
export const VALIDADE_URL_FOTO_S = 300
export const MAX_DIARIOS_GALERIA = 120

export async function lerGaleria(admin: Admin, obraId: string, og: ObraGrande): Promise<{ ok: true; fotos: FotoGaleria[] } | { ok: false }> {
  // Só os diários mais recentes: o `.in('rdo_id', …)` abaixo vai na URL (limite do gateway); o teto de fotos já é 200.
  const { data: rdos, error } = await admin
    .from('obras_rdo')
    .select('id, obra_id, data, estado')
    .eq('obra_id', obraId)
    .in('estado', ['validado', 'enviado'])
    .order('data', { ascending: false })
    .limit(MAX_DIARIOS_GALERIA)
  if (error) return { ok: false }
  const validos = ((rdos ?? []) as Linha[]).filter((r) => r.obra_id === obraId && VALIDO.has(r.estado))
  if (!validos.length) return { ok: true, fotos: [] }
  const dataDe = new Map(validos.map((r) => [String(r.id), String(r.data)]))
  const { data: linhas, error: errF } = await admin.from('obras_rdo_foto').select('*').in('rdo_id', [...dataDe.keys()])
  if (errF) return { ok: false }

  const etapaDe = new Map(og.plano.map((a) => [a.numero, a.etapa]))
  const candidatas = ((linhas ?? []) as Linha[])
    .filter((f) => dataDe.has(String(f.rdo_id)))
    .map((f) => ({ f, data: dataDe.get(String(f.rdo_id))! }))
    .filter(({ f, data }) => caminhoFotoValido(obraId, data, String(f.path ?? '')))
    .sort((a, b) => b.data.localeCompare(a.data) || Number(a.f.ordem ?? 0) - Number(b.f.ordem ?? 0))
    .slice(0, MAX_FOTOS_GALERIA)
  if (!candidatas.length) return { ok: true, fotos: [] }

  const { data: assinadas, error: errS } = await admin.storage
    .from('obras-fotos')
    .createSignedUrls(candidatas.map(({ f }) => String(f.path)), VALIDADE_URL_FOTO_S)
  if (errS) return { ok: false }
  const urlDe = new Map(((assinadas ?? []) as Linha[]).filter((s) => s.signedUrl && !s.error).map((s) => [String(s.path), String(s.signedUrl)]))

  const fotos: FotoGaleria[] = []
  for (const { f, data } of candidatas) {
    const url = urlDe.get(String(f.path))
    if (!url) continue
    // Etapa pela atividade da foto, quando a foto tiver uma; senão "Geral".
    const n = typeof f.atividade_numero === 'number' ? f.atividade_numero : null
    fotos.push({ id: String(f.id), url, legenda: (f.legenda as string | null) ?? null, data: dataBr(data), dataIso: data, etapa: (n !== null && etapaDe.get(n)) || 'Geral' })
  }
  return { ok: true, fotos }
}
