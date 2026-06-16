'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean; checklistId?: string }

export async function criarChecklistAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const tipo = formData.get('tipo') as string
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const observacoes = (formData.get('observacoes') as string).trim() || null
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null

  const itens = {
    lataria_ok: formData.get('lataria_ok') === 'true',
    vidros_ok: formData.get('vidros_ok') === 'true',
    pneus_ok: formData.get('pneus_ok') === 'true',
    combustivel_ok: formData.get('combustivel_ok') === 'true',
    itens_internos_ok: formData.get('itens_internos_ok') === 'true',
    estepe_ok: formData.get('estepe_ok') === 'true',
    macaco_ok: formData.get('macaco_ok') === 'true',
    triangulo_ok: formData.get('triangulo_ok') === 'true',
  }

  if (!tipo || !equipe_id || !veiculo_id)
    return { error: 'Tipo, equipe e veículo são obrigatórios' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('checklist')
    .insert({
      tipo,
      equipe_id,
      veiculo_id,
      motorista_id,
      observacoes,
      latitude,
      longitude,
      created_by: user?.id,
      ...itens,
    })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao salvar checklist' }

  revalidatePath('/sofia/checklist')
  return { success: true, checklistId: data.id }
}

export async function uploadFotoAction(
  checklistId: string,
  storagePath: string,
  posicao: string,
  lat: number | null,
  lng: number | null
) {
  const supabase = await createClient()
  await supabase.from('checklist_fotos').insert({
    checklist_id: checklistId,
    storage_path: storagePath,
    posicao,
    latitude: lat,
    longitude: lng,
    tirada_em: new Date().toISOString(),
  })
}
