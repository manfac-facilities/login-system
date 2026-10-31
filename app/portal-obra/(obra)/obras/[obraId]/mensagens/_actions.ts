'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'
import { obraLiberada } from '../../../_lib/guarda'
import { avisarEquipe } from '../../../_lib/aviso-mensagem'
import { gravarMensagemCliente } from '../../../_lib/mensagens'
import { origemConfere } from './_origem'

export type EstadoMensagem = { ok?: boolean; erro?: string }

export async function enviarMensagemAction(obraId: string, _prev: EstadoMensagem, form: FormData): Promise<EstadoMensagem> {
  if (!origemConfere(await headers())) return { erro: 'Requisição não permitida.' }
  const sessao = await lerSessao(await cookies())
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!obraLiberada(sessao, obraId)) return { erro: 'Obra não encontrada.' }
  const admin = createAdminClient()
  const texto = form.get('texto')
  const r = await gravarMensagemCliente(admin, { email: sessao.email, obraId, texto })
  if (!r.ok) return { erro: r.erro }
  await avisarEquipe(admin, { obraId, texto: String(texto).trim(), de: sessao.email })
  revalidatePath(`/portal-obra/obras/${obraId}/mensagens`)
  return { ok: true }
}
