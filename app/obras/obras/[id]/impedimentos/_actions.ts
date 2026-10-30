'use server'

/**
 * Server Actions de impedimentos e orientações da OBRA (Task 9a, spec §5.3/§7.1).
 *
 * Acesso: `obras` ou administrador, guarda falha fechada. O banco é a segunda
 * barreira (RLS; `criado_por` vem do JWT por trigger). Sem `export type` aqui —
 * tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import {
  RESPONSAVEIS,
  TIPOS_IMPEDIMENTO,
  exibirAoClientePadrao,
  type NovaOrientacao,
  type NovoImpedimento,
  type Resultado,
} from './_tipos'

const ISO = /^\d{4}-\d{2}-\d{2}$/
type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })

async function autorizar(): Promise<{ supabase: SupabaseClient } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if ((await hasSystemAccess(supabase, email, 'obras')) || (await isAdmin(supabase, email))) return { supabase }
  return falha('Sem acesso ao Gestão de Obras')
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '42501' || e.message.includes('row-level security')) return falha('Você não tem permissão para isso.')
  if (e.code === '23503') return falha('Referência inválida (obra, diário ou orientação não existe mais).')
  if (e.code === '23514') return falha('Dados inválidos: confira responsável e campos obrigatórios.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const texto = (s: string | null | undefined) => (s ?? '').trim() || null
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

function revalidar(obraId: string) {
  revalidatePath(`/obras/obras/${obraId}/impedimentos`)
  revalidatePath(`/obras/obras/${obraId}/diario`)
  revalidatePath(`/obras/obras/${obraId}`)
}

async function validarObra(supabase: SupabaseClient, obraId: string): Promise<Erro | null> {
  const { data, error } = await supabase.from('obras_obra').select('id, modalidade').eq('id', obraId).maybeSingle()
  if (error) return erroBanco('ler a obra', error)
  if (!data || data.modalidade !== 'obra') return falha('Obra não encontrada')
  return null
}

/** Diário a que o registro se liga: da mesma obra e ainda em rascunho. */
async function resolverRdo(
  supabase: SupabaseClient,
  obraId: string,
  rdoId: string | null | undefined,
): Promise<Erro | { rdoId: string | null; data: string | null }> {
  if (!rdoId) return { rdoId: null, data: null }
  const { data, error } = await supabase.from('obras_rdo').select('obra_id, estado, data').eq('id', rdoId).maybeSingle()
  if (error) return erroBanco('ler o diário', error)
  if (!data || data.obra_id !== obraId) return falha('Diário inválido')
  if (data.estado !== 'rascunho') return falha('Diário já validado — registre sem vincular ao diário')
  return { rdoId, data: data.data as string }
}

/** Campos comuns; devolve erro ou o que vai ao banco. */
function validarComum(
  obraId: string,
  i: { descricao: string; atividadeNumero: number | null; fotoPath: string | null; abertoEm?: string },
): Erro | { descricao: string; abertoEm: string } {
  const descricao = texto(i.descricao)
  if (!descricao) return falha('Descreva o que aconteceu')
  const abertoEm = i.abertoEm ?? hojeISO()
  if (!ISO.test(abertoEm)) return falha('Data inválida')
  if (i.atividadeNumero !== null && !(Number.isInteger(i.atividadeNumero) && i.atividadeNumero > 0)) {
    return falha('Atividade inválida')
  }
  if (i.fotoPath !== null && !i.fotoPath.startsWith(`${obraId}/impedimento/`)) return falha('Foto inválida')
  return { descricao, abertoEm }
}

export async function abrirImpedimentoAction(obraId: string, i: NovoImpedimento): Promise<Resultado & { id?: string }> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const comum = validarComum(obraId, i)
  if ('ok' in comum) return comum
  if (!i.responsavel || !RESPONSAVEIS.some((r) => r.valor === i.responsavel)) return falha('Diga quem é o responsável')
  if (i.tipo !== null && !(TIPOS_IMPEDIMENTO as readonly string[]).includes(i.tipo)) return falha('Tipo inválido')
  if (i.impactoDias !== null && !(Number.isFinite(i.impactoDias) && i.impactoDias >= 0 && i.impactoDias < 10000)) {
    return falha('Impacto em dias inválido')
  }

  const naoObra = await validarObra(supabase, obraId)
  if (naoObra) return naoObra
  const rdo = await resolverRdo(supabase, obraId, i.rdoId)
  if ('ok' in rdo) return rdo

  const { data, error } = await supabase
    .from('obras_impedimento')
    .insert({
      obra_id: obraId,
      categoria: 'impedimento',
      tipo: i.tipo,
      responsavel: i.responsavel,
      atividade_numero: i.atividadeNumero,
      descricao: comum.descricao,
      pessoa_cliente: texto(i.pessoaCliente),
      foto_path: i.fotoPath,
      trava_atividade: i.travaAtividade === true,
      impacto_dias: i.impactoDias,
      exibir_ao_cliente: i.exibirAoCliente ?? exibirAoClientePadrao(i.responsavel),
      aberto_em: rdo.data ?? comum.abertoEm,
      rdo_id: rdo.rdoId,
    })
    .select('id')
    .single()
  if (error) return erroBanco('registrar o impedimento', error)
  revalidar(obraId)
  return { ok: true, id: data.id as string }
}

export async function encerrarImpedimentoAction(id: string, encerradoEm: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (!ISO.test(encerradoEm)) return falha('Data inválida')

  const { data: imp, error: e1 } = await supabase
    .from('obras_impedimento')
    .select('id, obra_id, aberto_em, encerrado_em')
    .eq('id', id)
    .maybeSingle()
  if (e1) return erroBanco('ler o impedimento', e1)
  if (!imp) return falha('Impedimento não encontrado')
  if (imp.encerrado_em) return falha('Impedimento já encerrado')
  const abertoEm = String(imp.aberto_em).slice(0, 10)
  if (encerradoEm < abertoEm) {
    return falha(
      `A data de encerramento (${dataBR(encerradoEm)}) não pode ser anterior à abertura do impedimento (${dataBR(abertoEm)})`,
    )
  }

  const { error } = await supabase.from('obras_impedimento').update({ encerrado_em: encerradoEm }).eq('id', id)
  if (error) return erroBanco('encerrar o impedimento', error)
  revalidar(imp.obra_id as string)
  return { ok: true }
}

export async function registrarOrientacaoAction(obraId: string, o: NovaOrientacao): Promise<Resultado & { id?: string }> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const comum = validarComum(obraId, o)
  if ('ok' in comum) return comum
  const naoObra = await validarObra(supabase, obraId)
  if (naoObra) return naoObra
  const rdo = await resolverRdo(supabase, obraId, o.rdoId)
  if ('ok' in rdo) return rdo

  const { data, error } = await supabase
    .from('obras_impedimento')
    .insert({
      obra_id: obraId,
      categoria: 'orientacao',
      tipo: null,
      responsavel: null,
      atividade_numero: o.atividadeNumero,
      descricao: comum.descricao,
      pessoa_cliente: texto(o.pessoaCliente),
      foto_path: o.fotoPath,
      trava_atividade: false,
      impacto_dias: null,
      exibir_ao_cliente: o.exibirAoCliente ?? true,
      aberto_em: rdo.data ?? comum.abertoEm,
      rdo_id: rdo.rdoId,
    })
    .select('id')
    .single()
  if (error) return erroBanco('registrar a orientação', error)
  revalidar(obraId)
  return { ok: true, id: data.id as string }
}

/** "Orientação descumprida": liga o impedimento à orientação dada antes. */
export async function ligarDescumprimentoAction(impedimentoId: string, orientacaoId: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const [imp, ori] = await Promise.all([
    supabase.from('obras_impedimento').select('id, obra_id, categoria').eq('id', impedimentoId).maybeSingle(),
    supabase.from('obras_impedimento').select('id, obra_id, categoria').eq('id', orientacaoId).maybeSingle(),
  ])
  if (imp.error) return erroBanco('ler o impedimento', imp.error)
  if (ori.error) return erroBanco('ler a orientação', ori.error)
  if (!imp.data || imp.data.categoria !== 'impedimento') return falha('Impedimento não encontrado')
  if (!ori.data || ori.data.categoria !== 'orientacao') return falha('Orientação não encontrada')
  if (imp.data.obra_id !== ori.data.obra_id) return falha('A orientação é de outra obra')

  const { error } = await supabase.from('obras_impedimento').update({ orientacao_id: orientacaoId }).eq('id', impedimentoId)
  if (error) return erroBanco('ligar a orientação', error)
  revalidar(imp.data.obra_id as string)
  return { ok: true }
}
