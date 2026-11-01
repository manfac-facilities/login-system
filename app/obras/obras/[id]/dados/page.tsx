import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { receitaEmCentavos } from '../../_lib/medicao'
import { foraDoOrganograma, type Pessoa } from '../../_lib/organograma'
import type { Destinatario, Lado, TipoEnvio } from '../configuracoes/_tipos'
import type { AcessoPortal } from '../configuracoes/_tipos-portal'
import ValorReceita from './_receita'
import Organograma from './_organograma'
import type { OsReceita } from './_tipos'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-[15px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

/**
 * Aba Dados da obra (Fases B/C §2.1–2.2). Todo usuário do Obras vê o organograma; só admin edita.
 * Valor receita só para `obras_pode_ver_valores` (falha fechada). Chips de envio/portal só para o
 * admin (as tabelas e as actions das Configurações são de admin).
 */
export default async function DadosDaObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <Aviso>Esta tela é de quem é responsável pelas obras</Aviso>
  if (!UUID.test(id)) return <Aviso>Obra não encontrada</Aviso>

  const [podeR, obrasR, pessoasR, destR, acR] = await Promise.all([
    supabase.rpc('obras_pode_ver_valores', { p_obra: id }),
    supabase.from('obras_obra').select('id, os, loja, descricao, obra_pai_id, valor, cancelado_em').or(`id.eq.${id},obra_pai_id.eq.${id}`),
    supabase.from('obras_cliente_pessoa').select('id, nome, cargo, email, ordem').eq('obra_id', id).order('ordem').order('criado_em'),
    admin
      ? supabase.from('obras_destinatario').select('id, email, nome, funcao, lado, tipos, ativo').eq('obra_id', id).order('email')
      : Promise.resolve({ data: [], error: null }),
    admin ? supabase.from('obras_portal_acesso').select('id, email, nome, ativo').eq('obra_id', id).order('email') : Promise.resolve({ data: [], error: null }),
  ])
  if (obrasR.error) return <Aviso>Não deu para ler a obra agora. Recarregue em instantes.</Aviso>
  const valores = !podeR.error && podeR.data === true

  type O = { id: string; os: string | null; loja: string | null; descricao: string | null; obra_pai_id: string | null; valor: unknown; cancelado_em?: string | null }
  const linhas = (obrasR.data ?? []) as O[]
  const atual = linhas.find((o) => o.id === id)
  if (!atual) return <Aviso>Obra não encontrada</Aviso>
  const temAditivos = linhas.some((o) => o.obra_pai_id === id)
  const oss: OsReceita[] = linhas
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : (a.os ?? '').localeCompare(b.os ?? '')))
    .map((o) => ({
      id: o.id,
      os: o.os,
      descricao: o.id === id ? (temAditivos ? 'Obra principal (mãe)' : atual.obra_pai_id ? 'Aditivo' : 'Obra') : `Aditivo${o.descricao ? ` · ${o.descricao}` : ''}`,
      papel: o.id === id ? (temAditivos ? 'mae' : atual.obra_pai_id ? 'aditivo' : 'obra') : 'aditivo',
      cancelada: !!o.cancelado_em,
      // Valor só sai do servidor para quem pode ver valores.
      receitaCentavos: valores ? receitaEmCentavos(o.valor) : null,
    }))

  const pessoas: Pessoa[] = pessoasR.error
    ? []
    : ((pessoasR.data ?? []) as Pessoa[]).map((p) => ({ id: p.id, nome: p.nome, cargo: p.cargo ?? null, email: p.email ?? null, ordem: Number(p.ordem) }))
  const destinatarios: Destinatario[] = ((destR.data ?? []) as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    email: d.email as string,
    nome: (d.nome as string | null) ?? null,
    funcao: (d.funcao as string | null) ?? null,
    lado: ((d.lado as Lado | null) ?? 'cliente') as Lado,
    tipos: (d.tipos ?? []) as TipoEnvio[],
    ativo: d.ativo !== false,
  }))
  const acessos: AcessoPortal[] = ((acR.data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.id as string,
    email: a.email as string,
    nome: (a.nome as string | null) ?? null,
    ativo: a.ativo !== false,
  }))
  const chipsOk = admin && !destR.error && !acR.error

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-(--obra-muted-texto)">
        Só administrador edita. Engenheiro e supervisor veem; valores só para quem vê o Financeiro.
      </p>
      {valores ? <ValorReceita obraId={id} oss={oss} admin={admin} /> : null}
      {pessoasR.error ? (
        <Aviso>Não deu para ler o organograma agora. Recarregue em instantes.</Aviso>
      ) : (
        <Organograma
          obraId={id}
          admin={admin}
          pessoas={pessoas}
          chips={chipsOk ? { destinatarios, acessos } : null}
          fora={chipsOk ? foraDoOrganograma(pessoas, destinatarios, acessos) : []}
          erroChips={admin && !chipsOk}
        />
      )}
    </div>
  )
}
