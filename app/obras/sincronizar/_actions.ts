'use server'

/** Porteiro humano da sincronização; a execução compartilhada mora em `_execucao.ts`. */

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { executarSincronizacao } from './_execucao'
import type { EstadoSincronizacao } from './_execucao'
/**
 * NAO reexporte tipos daqui. Arquivo marcado como use server so pode exportar
 * funcao assincrona: o build de producao transforma cada export numa referencia
 * de runtime, e um tipo nao existe em runtime. Um export type aqui derrubou a
 * tela inteira em 15/09/2026 com ReferenceError: EstadoSincronizacao is not
 * defined, sem quebrar teste nenhum -- em teste os tipos somem direito.
 * Quem precisa do tipo importa de ./_execucao.
 */


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
