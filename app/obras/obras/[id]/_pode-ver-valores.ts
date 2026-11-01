import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * `obras_pode_ver_valores` memorizada por requisição: o layout (item Financeiro da sidebar) e o
 * painel da obra (alertas de medição) perguntam a mesma coisa no mesmo render — com o `cache`
 * do React, a RPC roda uma vez só. Cliente da SESSÃO; falha fechada (erro, null ou qualquer coisa
 * diferente de true → false). Só chame depois da guarda de acesso.
 */
export const podeVerValoresDaRequisicao = cache(async (obraId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('obras_pode_ver_valores', { p_obra: obraId })
  return !error && data === true
})
