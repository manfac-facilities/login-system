'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DOCUMENTO_TIPOS, isValidEnum } from '@/lib/sofia/enums'

type State = { error?: string; success?: boolean }

export async function criarDocumentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const tipo = formData.get('tipo') as string
  const numero = (formData.get('numero') as string).trim() || null
  const vencimento = formData.get('vencimento') as string
  const storage_path = (formData.get('storage_path') as string | null) || null

  if (!veiculo_id || !tipo || !vencimento) return { error: 'Veículo, tipo e vencimento são obrigatórios' }
  if (!isValidEnum(DOCUMENTO_TIPOS, tipo)) return { error: 'Tipo de documento inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('documentos_veiculo').insert({ veiculo_id, tipo, numero, vencimento, storage_path })

  if (error) return { error: 'Erro ao registrar documento' }
  revalidatePath('/sofia/documentos')
  return { success: true }
}

export async function obterUrlDocumentoAction(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }

  const { data, error } = await supabase.storage.from('sofia-anexos').createSignedUrl(storagePath, 60)
  if (error || !data) return { error: 'Erro ao gerar link do arquivo' }
  return { url: data.signedUrl }
}
