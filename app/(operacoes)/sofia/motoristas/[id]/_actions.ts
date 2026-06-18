'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function marcarTermoAssinadoAction(motoristaId: string, assinado: boolean) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('motorista_documentos')
    .select('id')
    .eq('motorista_id', motoristaId)
    .eq('tipo', 'termo_uso')
    .maybeSingle()

  const hoje = new Date().toISOString().split('T')[0]
  if (existing) {
    await supabase.from('motorista_documentos').update({ assinado, data_assinatura: assinado ? hoje : null }).eq('id', existing.id)
  } else {
    await supabase.from('motorista_documentos').insert({ motorista_id: motoristaId, tipo: 'termo_uso', assinado, data_assinatura: assinado ? hoje : null })
  }
  revalidatePath(`/sofia/motoristas/${motoristaId}`)
}
