/**
 * Guarda das páginas do portal do cliente (Leva 5 §3.1, território de autorização).
 *
 * - Sem sessão válida (`lerSessao` revalida o acesso ativo a cada request) → /portal-obra.
 * - Id de obra da URL fora de `sessao.obras` (ou fora do formato) → 404, ANTES de
 *   qualquer leitura da obra: nada da obra de outro cliente (nem o nome) é lido.
 * - Leitura só pelo servidor com o cliente admin, sempre pelo id já autorizado.
 *
 * Toda página chama a guarda (layout não re-renderiza na navegação: não basta lá).
 * `cache` do React: layout e página do mesmo request compartilham sessão e leitura.
 */
import { cache } from 'react'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { lerSessao, type SessaoPortal } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'
import { lerObraGrande, lerPlanos, lerRestricoes, type ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { montarVisaoCliente, type VisaoCliente } from './visao'
import { hojeISO } from '@/app/obras/_lib/tipos'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A obra pedida está liberada para esta sessão? Formato estrito + pertença exata. */
export const obraLiberada = (sessao: SessaoPortal, obraId: unknown): obraId is string =>
  typeof obraId === 'string' && UUID.test(obraId) && sessao.obras.includes(obraId)

export const sessaoAtual = cache(async (): Promise<SessaoPortal | null> => lerSessao(await cookies()))

export async function exigirSessao(): Promise<SessaoPortal> {
  const s = await sessaoAtual()
  if (!s) redirect('/portal-obra')
  return s
}

const obraGrandeDoPortal = cache(async (obraId: string, hoje: string) => lerObraGrande(createAdminClient(), obraId, hoje))

export type ObraDoPortal = { sessao: SessaoPortal; og: ObraGrande; hoje: string }

/** Sessão + obra autorizada + leitura consolidada. 404 para obra fora da sessão, inexistente ou SPOT. */
export async function exigirObra(obraId: string): Promise<ObraDoPortal> {
  const sessao = await exigirSessao()
  if (!obraLiberada(sessao, obraId)) notFound()
  const hoje = hojeISO()
  const lida = await obraGrandeDoPortal(obraId, hoje)
  if (!lida.ok) {
    if (lida.erro === 'Obra não encontrada') notFound()
    throw new Error('portal-obra: falha ao ler a obra')
  }
  if (lida.dados.obra.modalidade !== 'obra') notFound()
  return { sessao, og: lida.dados, hoje }
}

const visaoDoPortal = cache(async (obraId: string, hoje: string, og: ObraGrande): Promise<VisaoCliente> => {
  const admin = createAdminClient()
  const [pl, rs] = await Promise.all([lerPlanos(admin, obraId), lerRestricoes(admin, obraId)])
  if (!pl.ok || !rs.ok) throw new Error('portal-obra: falha ao ler planos/restrições')
  return montarVisaoCliente({ obra: og, planos: pl.planos, restricoes: rs.restricoes, hoje })
})

/** Guarda + visão do cliente já montada (só textos e números do lado cliente). */
export async function exigirVisao(obraId: string): Promise<ObraDoPortal & { visao: VisaoCliente }> {
  const o = await exigirObra(obraId)
  return { ...o, visao: await visaoDoPortal(obraId, o.hoje, o.og) }
}
