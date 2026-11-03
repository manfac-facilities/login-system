/**
 * Guarda das Server Actions dos relatórios (semanal e de período): sessão →
 * acesso `obras` ou admin → obra lida PELA SESSÃO (RLS) com modalidade 'obra'
 * → engenheiro da obra ou admin. Falha fechada em cada passo. O id devolvido é
 * o da linha do banco, não o do navegador.
 *
 * Módulo comum (não `use server`): exportar daqui não cria endpoint. Só deve
 * ser importado por código de servidor (as actions).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export async function autorizarEngenheiroDaObra(
  obraId: string,
  p: {
    /** Mensagem de quem não é o engenheiro nem admin. */
    soEngenheiro: string
    /** Tradução do erro de banco ao ler a obra (a mesma das demais escritas da action). */
    erroBanco: (acao: string, e: { message: string; code?: string }) => Erro
  },
): Promise<{ supabase: SupabaseClient; obraId: string } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return { ok: false, erro: 'Não autenticado' }
  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return { ok: false, erro: 'Sem acesso ao Gestão de Obras' }
  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, modalidade, engenheiro_email')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return p.erroBanco('ler a obra', error)
  const obra = data as Linha | null
  if (!obra || obra.modalidade !== 'obra') return { ok: false, erro: 'Obra não encontrada' }
  const engenheiro = String(obra.engenheiro_email ?? '').trim().toLowerCase()
  if (!admin && !(engenheiro !== '' && engenheiro === email)) return { ok: false, erro: p.soEngenheiro }
  return { supabase, obraId: String(obra.id) }
}
