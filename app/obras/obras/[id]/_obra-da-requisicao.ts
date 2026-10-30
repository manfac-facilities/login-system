import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { lerObraGrande } from '../_lib/leitura'

/**
 * `lerObraGrande` memorizada por requisição: o layout (ShellObra: sinal, versão,
 * "dados até") e a página da obra leem a mesma obra no mesmo render — com o
 * `cache` do React, as ~9 consultas rodam uma vez só (Disk IO do Supabase).
 * Só chame depois da guarda de acesso.
 */
export const lerObraDaRequisicao = cache(async (obraId: string, hoje: string) =>
  lerObraGrande(await createClient(), obraId, hoje),
)
