'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import type { Cliente, LinhaErro } from '@/lib/conversor-os/types'

type State = { error?: string; success?: boolean }

export interface RegistrarImportacaoInput {
  cliente: Cliente
  filename: string
  storagePath: string
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
}

export async function registrarImportacaoAction(input: RegistrarImportacaoInput): Promise<State> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'conversor-os')))
    return { error: 'Sem acesso ao Conversor OS' }

  const { error } = await supabase.from('conversor_os_imports').insert({
    user_id: user.id,
    user_email: user.email,
    cliente: input.cliente,
    filename: input.filename,
    storage_path: input.storagePath,
    total_rows: input.linhasOrigem,
    converted_rows: input.linhasConvertidas,
    duplicates_removed: input.duplicadosRemovidos,
    errors: input.erros,
    imported_at: new Date().toISOString(),
  })
  if (error) return { error: 'Erro ao registrar importação' }

  revalidatePath('/conversor-os/historico')
  return { success: true }
}

export async function obterUrlDownloadAction(
  storagePath: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'conversor-os')))
    return { error: 'Sem acesso ao Conversor OS' }

  const { data, error } = await supabase.storage
    .from('conversor-os-arquivos')
    .createSignedUrl(storagePath, 60)
  if (error || !data) return { error: 'Erro ao gerar link de download' }
  return { url: data.signedUrl }
}
