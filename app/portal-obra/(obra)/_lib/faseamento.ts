/**
 * Faseamento no portal do cliente (Leva 6b §2 item 2). Cliente admin, SEMPRE pelo
 * id da obra que a guarda já autorizou. Só revisão `emitida`, e só a ÚLTIMA de cada
 * fase (maior `revisao`): rascunho nunca sai daqui (filtro no banco E no código).
 * Base e nome da fase vêm congelados da própria revisão (`planta_*`, `fase_*`),
 * nunca do mapa nem da fase viva. Não importa o react-pdf (o layout carrega este arquivo).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { camadasSchema, type Camada } from '@/app/obras/obras/[id]/faseamento/_lib/camadas'
import { caminhoPlantaValido } from '@/app/obras/obras/[id]/mapa/_regras'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const VALIDADE_URL_FASEAMENTO_S = 300
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FaseCliente = {
  revisaoId: string
  faseId: string
  numero: number
  nome: string
  revisao: number
  /** ISO da emissão. */
  emitidaEm: string | null
  camadas: Camada[]
  plantaUrl: string | null
  plantaLargura: number | null
  plantaAltura: number | null
}

/** Tabela/coluna ausente (app subiu antes do SQL da 6b): o faseamento some, o resto do portal segue. */
const SEM_SQL = new Set(['PGRST205', '42P01', '42703'])
const semSql = (e: { code?: string } | null) => !!e && !!e.code && SEM_SQL.has(e.code)

/**
 * Passo leve: a última emitida de cada fase (maior `revisao`), por número da fase, SEM o jsonb das camadas.
 * Lança em falha de leitura; SQL da 6b ausente = lista vazia.
 */
async function ultimasEmitidas(admin: Admin, obraId: string): Promise<Linha[]> {
  const { data, error } = await admin
    .from('obras_fase_revisao')
    .select('id, obra_id, fase_id, revisao, status, emitida_em, planta_path, planta_largura, planta_altura, fase_nome, fase_numero')
    .eq('obra_id', obraId)
    .eq('status', 'emitida')
    .order('revisao', { ascending: false })
  if (semSql(error)) return []
  if (error) throw new Error('portal-obra: falha ao ler o faseamento')
  const ultimas = new Map<string, Linha>()
  for (const r of (data ?? []) as Linha[]) {
    if (r.obra_id !== obraId || r.status !== 'emitida') continue
    const atual = ultimas.get(String(r.fase_id))
    if (!atual || Number(r.revisao) > Number(atual.revisao)) ultimas.set(String(r.fase_id), r)
  }
  return [...ultimas.values()].sort((a, b) => Number(a.fase_numero) - Number(b.fase_numero))
}

/** [] = nada emitido (a seção não aparece). Lança em falha de leitura. */
export async function lerFaseamentoDoPortal(admin: Admin, obraId: string): Promise<FaseCliente[]> {
  const linhas = await ultimasEmitidas(admin, obraId)
  if (!linhas.length) return []
  // Passo 2: as camadas só das vencedoras (continua filtrando pela obra e pelo status).
  const { data: pesadas, error } = await admin
    .from('obras_fase_revisao')
    .select('id, obra_id, status, camadas')
    .eq('obra_id', obraId)
    .eq('status', 'emitida')
    .in('id', linhas.map((l) => l.id))
  if (semSql(error)) return []
  if (error) throw new Error('portal-obra: falha ao ler o faseamento')
  const camadasDe = new Map(((pesadas ?? []) as Linha[]).filter((x) => x.obra_id === obraId && x.status === 'emitida').map((x) => [String(x.id), x.camadas]))
  const storage = admin.storage.from('obras-fotos')
  return Promise.all(
    linhas.map(async (r) => {
      let plantaUrl: string | null = null
      const path = r.planta_path ? String(r.planta_path) : null
      if (path && r.planta_largura && r.planta_altura && caminhoPlantaValido(obraId, path)) {
        const { data } = await storage.createSignedUrl(path, VALIDADE_URL_FASEAMENTO_S)
        plantaUrl = data?.signedUrl ?? null
      }
      const c = camadasSchema.safeParse(camadasDe.get(String(r.id)))
      return {
        revisaoId: String(r.id),
        faseId: String(r.fase_id),
        numero: Number(r.fase_numero),
        nome: String(r.fase_nome ?? ''),
        revisao: Number(r.revisao),
        emitidaEm: r.emitida_em ? String(r.emitida_em) : null,
        camadas: c.success ? c.data : [],
        plantaUrl,
        plantaLargura: plantaUrl ? Number(r.planta_largura) : null,
        plantaAltura: plantaUrl ? Number(r.planta_altura) : null,
      }
    }),
  )
}

/** A obra tem alguma revisão emitida? Decide (junto com os ambientes) se a aba Mapa aparece. Erro → false. */
export async function obraTemFaseamento(obraId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('obras_fase_revisao').select('id').eq('obra_id', obraId).eq('status', 'emitida').limit(1)
  return !error && (data ?? []).length > 0
}

/**
 * A revisão pode virar PDF no portal? Só se for a ÚLTIMA emitida da sua fase nesta obra
 * (é a única que a seção mostra; uma revisão antiga já substituída não é aberta por id).
 * Devolve a linha leve (planta_path etc., sem camadas), false se não pode, 'erro' se a leitura falhou.
 */
export async function revisaoAbrivelNoPortal(admin: Admin, obraId: string, revisaoId: string): Promise<Linha | false | 'erro'> {
  if (!UUID.test(revisaoId)) return false
  try {
    return (await ultimasEmitidas(admin, obraId)).find((r) => r.id === revisaoId) ?? false
  } catch {
    return 'erro'
  }
}
