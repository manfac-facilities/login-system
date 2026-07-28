import type { SupabaseClient } from '@supabase/supabase-js'

export interface CapturedPhoto {
  blob: Blob
  posicao: string
  lat: number | null
  lng: number | null
}

export interface FotoUploadInfo {
  path: string
  lat: number | null
  lng: number | null
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
    fotos.map(async (foto) => {
      const path = `${prefix}/${foto.posicao.replace(/\s/g, '-')}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(bucket).upload(path, foto.blob, {
        contentType: 'image/jpeg',
      })
      return { posicao: foto.posicao, path, lat: foto.lat, lng: foto.lng, ok: !error }
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
  for (const r of results) fotosMap[r.posicao] = { path: r.path, lat: r.lat, lng: r.lng }
  return { ok: true, fotos: fotosMap }
}
