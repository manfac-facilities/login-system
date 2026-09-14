'use server'

/** Porteiro humano da sincronização; a execução compartilhada mora em `_execucao.ts`. */

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { executarSincronizacao } from './_execucao'
import type { EstadoSincronizacao, RelatorioSincronizacao } from './_execucao'

export type { EstadoSincronizacao, RelatorioSincronizacao }

export async function sincronizarComFieldAction(): Promise<EstadoSincronizacao> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  if (!email) return { error: 'Sessão expirada. Entre de novo.' }
  if (!(await isAdmin(supabase, email))) {
    return { error: 'Só administradores podem puxar as OS do Field Control.' }
  }

  return executarSincronizacao(supabase, {
    tipo: 'completa',
    origem: 'botao',
    criadoPor: user?.id ?? null,
  })
}
