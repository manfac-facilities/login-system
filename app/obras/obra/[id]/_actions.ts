'use server'

/**
 * Server Actions da Ficha da obra.
 *
 * Receita fixa do hub (spec §3), na ordem: `createClient()` → `auth.getUser()`
 * → `hasSystemAccess(..., 'obras')` → query → `revalidatePath` → retorno
 * `{error?}` / `{success?}`. **Nunca `throw`** — erro vira mensagem em
 * português, não stack trace na cara do usuário.
 *
 * Decisão 8 da spec: `null` é o único sentinela de vazio. String vazia nunca é
 * gravada — `""` e `null` convivendo é bug garantido.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { CICLO, PRIORIDADES, hojeISO, type Etapa, type Prioridade } from '../../_lib/tipos'

export type EstadoAcao = { error?: string; success?: boolean }

const SEM_ACESSO = 'Sem acesso ao Controle de Obras'
const NAO_AUTENTICADO = 'Não autenticado'

const ETAPAS_VALIDAS = CICLO.map((c) => c.k)

/** Vazio é `null`, sempre. Nunca `""`. */
function nulo(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/**
 * As colunas que registram QUEM mudou a etapa e QUANDO ainda não existem em
 * `sdd-sql-obras-v0.sql` (arquivo da frente A, que esta frente não pode
 * editar). O update tenta gravá-las; se o PostgREST responder que a coluna não
 * existe, refaz sem elas — a troca de etapa continua funcionando e passa a
 * registrar autoria sozinha no dia em que a migration ganhar:
 *
 *   alter table public.obras_obra
 *     add column if not exists etapa_por text,
 *     add column if not exists etapa_em timestamptz;
 */
function colunaInexistente(erro: { code?: string; message?: string } | null): boolean {
  if (!erro) return false
  if (erro.code === 'PGRST204') return true
  return /column .* does not exist|Could not find the '.*' column/i.test(erro.message ?? '')
}

/**
 * TROCA DE ETAPA MANUAL — decisão técnica 6 da spec.
 *
 * O mockup não tem gatilho para `levantamento → andamento` nem para
 * `andamento ↔ paralisado`: sem esta ação o quadro trava no primeiro dia de uso
 * real. **Sem trava por papel** (decisão técnica 1): qualquer usuário com
 * acesso muda a etapa. Travar exige a resposta do cliente (decisão G, aberta);
 * não travar só permite, e é reversível.
 */
export async function mudarEtapaAction(obraId: string, etapa: string): Promise<EstadoAcao> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: NAO_AUTENTICADO }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }

  if (!ETAPAS_VALIDAS.includes(etapa as Etapa)) return { error: 'Etapa inválida' }

  const hoje = hojeISO()
  const base = {
    etapa,
    // Quanto tempo a obra está parada NA ETAPA é o número que hoje não existe
    // em lugar nenhum. Ele só continua verdadeiro se zerar a cada troca.
    desde_etapa: hoje,
    atualizacao: hoje,
  }

  let { error } = await supabase
    .from('obras_obra')
    .update({ ...base, etapa_por: user.email, etapa_em: new Date().toISOString() })
    .eq('id', obraId)

  if (colunaInexistente(error)) {
    ;({ error } = await supabase.from('obras_obra').update(base).eq('id', obraId))
  }

  if (error) return { error: 'Erro ao mudar a etapa da obra' }

  revalidatePath(`/obras/obra/${obraId}`)
  revalidatePath('/obras/base')
  return { success: true }
}

export type DadosTriagem = {
  resp: string
  equipe: string
  prioridade: string
  inicio: string
  duracao: string
  libPor?: string
  libEm?: string
}

/**
 * TRIAGEM — "Liberar para o diário do dia" (`liberarObra(mockup:3931)`).
 *
 * Os cinco campos obrigatórios são revalidados AQUI, não só na tela: a trava do
 * botão é conforto, a garantia é a Server Action. Liberado por / Data da
 * liberação continuam **opcionais** e fora do checklist — obrigar o campo faria
 * alguém inventar um nome só para destravar a tela, que é exatamente o dado
 * falso que este sistema existe para não ter.
 */
export async function liberarObraAction(
  obraId: string,
  dados: DadosTriagem
): Promise<EstadoAcao> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: NAO_AUTENTICADO }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }

  const resp = nulo(dados.resp)
  const equipe = nulo(dados.equipe)
  const prioridade = nulo(dados.prioridade)
  const inicio = nulo(dados.inicio)
  const duracao = Number.parseInt(dados.duracao ?? '', 10)

  if (!resp || !equipe || !prioridade || !inicio || !Number.isFinite(duracao)) {
    return { error: 'Preencha os cinco campos antes de liberar' }
  }
  if (!PRIORIDADES.includes(prioridade as Prioridade)) return { error: 'Prioridade inválida' }
  if (duracao < 1 || duracao > 180) return { error: 'A duração precisa ficar entre 1 e 180 dias' }

  const hoje = hojeISO()
  const libPor = nulo(dados.libPor)

  const { data, error } = await supabase
    .from('obras_obra')
    .update({
      pcm: resp,
      equipe,
      prioridade,
      inicio_plan: inicio,
      duracao,
      // Sem nome de quem liberou, a data da liberação não significa nada — as
      // duas andam juntas ou nenhuma é gravada.
      liberado_por: libPor,
      liberado_em: libPor ? (nulo(dados.libEm) ?? hoje) : null,
      etapa: 'levantamento',
      desde_etapa: hoje,
      atualizacao: hoje,
      pendencia: 'Finalizar levantamento, confirmar material e programar a equipe',
      pend_resp: resp,
      prox_acao: 'Concluir levantamento',
    })
    .eq('id', obraId)
    .eq('etapa', 'definir')
    .select('id')

  if (error) return { error: 'Erro ao liberar a obra' }
  // Zero linhas afetadas não é erro para o Postgres, mas é para nós: significa
  // que a obra saiu de "Aguardando definição" entre o carregamento da tela e o
  // clique — outra aba, outra pessoa, ou um duplo clique. Sem esta checagem a
  // ação dizia "deu certo" e mandava para a base sem ter mudado nada.
  if (!data || data.length === 0) {
    return { error: 'Esta obra já foi liberada por outra pessoa. Recarregue a página.' }
  }

  revalidatePath(`/obras/obra/${obraId}`)
  revalidatePath('/obras/base')
  revalidatePath('/obras/diario')
  return { success: true }
}
