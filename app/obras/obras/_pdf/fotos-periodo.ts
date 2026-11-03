/**
 * Fotos dos relatórios (semanal e de período) — comum aos dois carregadores.
 *
 * Elegível = foto de `obras_rdo_foto` de diário VALIDADO/ENVIADO desta obra com
 * data no período, lida pelo cliente da sessão (RLS vale). O conteúdo congelado
 * guarda só os ids das fotos; na hora do PDF eles são re-resolvidos contra as
 * elegíveis (id estranho some), e o caminho é conferido com regex estrita
 * (`<obra>/rdo/<data>/<arquivo>`) antes do único uso da service role: o download.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FotoSemanalPdf } from './semanal'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAX_BYTES_FOTO = 1_500_000

/** Foto de diário validado do período (linha de `obras_rdo_foto` + data do diário). */
export type FotoRef = { id: string; path: string; legenda: string | null; data: string }

/** Todas as fotos dos diários validados/enviados DESTA obra em [inicio, fim], em ordem (data do diário, ordem). */
export async function fotosElegiveisDoPeriodo(supabase: SupabaseClient, obraId: string, inicio: string, fim: string): Promise<FotoRef[]> {
  const { data: rdos, error } = await supabase
    .from('obras_rdo')
    .select('id, data, estado')
    .eq('obra_id', obraId)
    .gte('data', inicio)
    .lte('data', fim)
  const validos = ((rdos ?? []) as Linha[]).filter((r) => r.estado === 'validado' || r.estado === 'enviado')
  if (error || !validos.length) return []
  const dataDe = new Map(validos.map((r) => [String(r.id), String(r.data)]))
  const { data: linhas, error: errF } = await supabase
    .from('obras_rdo_foto')
    .select('*')
    .in('rdo_id', [...dataDe.keys()])
    .order('ordem')
  if (errF) return []
  return ((linhas ?? []) as Linha[])
    .filter((f) => dataDe.has(String(f.rdo_id)))
    .sort((a, b) => dataDe.get(String(a.rdo_id))!.localeCompare(dataDe.get(String(b.rdo_id))!) || Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
    .map((f) => ({ id: String(f.id), path: String(f.path ?? ''), legenda: (f.legenda as string | null) ?? null, data: dataDe.get(String(f.rdo_id))! }))
}

/** Ids congelados → fotos elegíveis (sem repetição, na ordem congelada); sem ids, as primeiras `max`. */
export function fotosDosIds(ids: string[] | undefined, elegiveis: FotoRef[], max: number): FotoRef[] {
  return ids
    ? [...new Set(ids)].map((id) => elegiveis.find((f) => f.id === id)).filter((f): f is FotoRef => !!f)
    : elegiveis.slice(0, max)
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const ARQUIVO = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/
/** Caminho canônico `<obra>/rdo/<data>/<arquivo>`; arquivo sem barra, `..`, `%`, `?`, `#` nem barra invertida. */
export const caminhoFotoValido = (obraId: string, data: string, path: string): boolean => {
  const prefixo = `${obraId}/rdo/${data}/`
  const arquivo = path.slice(prefixo.length)
  return ISO.test(data) && path.startsWith(prefixo) && ARQUIVO.test(arquivo) && !arquivo.includes('..')
}

/** JPEG ou PNG pelo cabeçalho; outro formato o react-pdf não desenha. */
function formatoDe(b: Buffer): FotoSemanalPdf['formato'] | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) return 'png'
  return null
}

/** Baixa até `max` fotos (service role), só do caminho canônico desta obra. */
export async function baixarFotos(
  obraId: string,
  refs: FotoRef[],
  max: number,
  log: string,
): Promise<{ fotos: FotoSemanalPdf[]; omitidas: number }> {
  const fotos: FotoSemanalPdf[] = []
  let omitidas = 0
  if (!refs.length) return { fotos, omitidas }
  const bucket = createAdminClient().storage.from('obras-fotos')
  for (const { path, legenda, data } of refs.slice(0, max)) {
    const valido = caminhoFotoValido(obraId, data, path)
    const { data: blob, error: e } = valido ? await bucket.download(path) : { data: null, error: null }
    const dados = blob && !e ? Buffer.from(await blob.arrayBuffer()) : null
    const formato = dados && dados.length <= MAX_BYTES_FOTO ? formatoDe(dados) : null
    if (!dados || !formato) {
      console.warn(`[${log}] foto omitida ${path}: ${e?.message ?? `${dados?.length ?? 0} bytes`}`)
      omitidas++
      continue
    }
    fotos.push({ dados, formato, legenda, data })
  }
  return { fotos, omitidas }
}

/** Nome de arquivo seguro a partir do nome da loja. */
export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'obra'
