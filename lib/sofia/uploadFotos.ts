import type { SupabaseClient } from '@supabase/supabase-js'
import type { TipoFoto } from './fotosChecklist'

export interface CapturedPhoto {
  blob: Blob
  posicao: string
  lat: number | null
  lng: number | null
  /** checklist: obrigatoria | interna | extra | avaria_peca | avaria_dano (sinistro não usa) */
  tipo_foto?: TipoFoto
  /** checklist: referência LOCAL da avaria no formulário (não é o id do banco, que ainda não existe) */
  avaria_ref?: string
}

export interface FotoUploadInfo {
  path: string
  lat: number | null
  lng: number | null
  tipo_foto?: TipoFoto
  avaria_ref?: string
}

export type UploadFotosResult =
  | { ok: true; fotos: Record<string, FotoUploadInfo> }
  | { ok: false; error: string; falhas: string[] }

/**
 * Sobe todas as fotos capturadas para o storage ANTES do registro (checklist
 * ou sinistro) existir no banco — a ordem inversa da anterior, que criava o
 * registro primeiro e subia as fotos depois, deixando um registro "órfão"
 * sem foto quando o upload falhava (achado U-02 da auditoria). Se qualquer
 * upload falhar, nenhum caminho é retornado — quem chama não deve escrever
 * nada no banco nesse caso.
 */
export async function uploadFotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  bucket: string,
  prefix: string,
  fotos: CapturedPhoto[]
): Promise<UploadFotosResult> {
  const results = await Promise.all(
    fotos.map(async (foto, i) => {
      // o índice evita colisão de duas fotos tiradas no mesmo milissegundo
      const path = `${prefix}/${foto.posicao.replace(/\s/g, '-')}-${i}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(bucket).upload(path, foto.blob, {
        contentType: 'image/jpeg',
      })
      return { posicao: foto.posicao, path, lat: foto.lat, lng: foto.lng, tipo_foto: foto.tipo_foto, avaria_ref: foto.avaria_ref, ok: !error }
    })
  )

  const falhas = results.filter((r) => !r.ok).map((r) => r.posicao)
  if (falhas.length > 0) {
    return {
      ok: false,
      error: `Falha ao enviar foto(s): ${falhas.join(', ')}. Tente novamente.`,
      falhas,
    }
  }

  const fotosMap: Record<string, FotoUploadInfo> = {}
  for (const r of results) {
    const info: FotoUploadInfo = { path: r.path, lat: r.lat, lng: r.lng }
    if (r.tipo_foto) info.tipo_foto = r.tipo_foto
    if (r.avaria_ref) info.avaria_ref = r.avaria_ref
    fotosMap[r.posicao] = info
  }
  return { ok: true, fotos: fotosMap }
}
