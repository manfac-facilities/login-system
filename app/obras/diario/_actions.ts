'use server'

/**
 * Server Actions do Diário do dia.
 *
 * Receita fixa do hub (spec §3): createClient() → auth.getUser() →
 * hasSystemAccess(..., 'obras') → query → revalidatePath → `{error?}` /
 * `{success?}`. NUNCA lança — o client renderiza a mensagem, não uma tela de
 * erro do Next.
 *
 * O CORAÇÃO DO SISTEMA está em `abrirTarefas`, aqui embaixo: salvar o diário é
 * o único momento em que uma falta deixa de terminar em registro e vira tarefa
 * com dono e prazo. Ninguém digita tarefa neste sistema.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import {
  CHAVE_EQUIPE,
  chaveDaEquipe,
  destinoDe,
  hojeISO,
  horaISO,
  ITEM_FOTO,
  ITENS,
  NAO_FALTOU,
  pedeFoto,
  prazoPadrao,
  BLOQUEIOS,
  contadoresDoDiario,
  type Etapa,
  type RegistroDiario,
} from '../_lib/tipos'
import { resolverChave } from './_pessoa'

export type EstadoDiario = { error?: string; success?: boolean }

export type EntradaDiario = {
  obraId: string
  andou: boolean
  /** Uma das opções de `ITENS`. Vazio vira "Não faltou". */
  item: string
  /** Um dos `BLOQUEIOS`. Obrigatório quando `andou = false`. */
  motivo: string | null
  obs: string | null
  /** Caminho no bucket `obras-fotos`, já subido pelo client. Null = não veio. */
  fotoPath: string | null
}

const SEM_ACESSO = 'Sem acesso ao Controle de Obras'
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024

/** A obra, com o mínimo que as regras precisam. */
type ObraMinima = { id: string; etapa: Etapa; equipe: string | null; pcm: string | null }

/**
 * Salva a resposta do dia e abre as tarefas que a resposta gerou.
 *
 * ÚNICA TRAVA (decisão C, fechada com o cliente): "não andou" exige motivo.
 * Nada mais barra o salvamento — nem item, nem observação, nem foto. Não
 * acrescente validação aqui: a tela foi aprovada assim.
 */
export async function salvarDiarioAction(entrada: EntradaDiario): Promise<EstadoDiario> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }

  const item = ITENS.includes(entrada.item as (typeof ITENS)[number]) ? entrada.item : NAO_FALTOU
  const motivoBruto = (entrada.motivo ?? '').trim()
  const motivo = entrada.andou ? null : motivoBruto
  if (!entrada.andou && !motivo) return { error: 'Diga por que não andou.' }
  if (motivo && !BLOQUEIOS.includes(motivo as (typeof BLOQUEIOS)[number])) {
    return { error: 'Diga por que não andou.' }
  }

  const { data: obra, error: erroObra } = await supabase
    .from('obras_obra')
    .select('id, etapa, equipe, pcm')
    .eq('id', entrada.obraId)
    .maybeSingle<ObraMinima>()
  if (erroObra || !obra) return { error: 'Obra não encontrada' }

  const dia = hojeISO()
  const hora = horaISO()
  const obs = (entrada.obs ?? '').trim()

  if (entrada.fotoPath) {
    if (entrada.fotoPath !== `${obra.id}/${dia}.jpg`) {
      return { error: 'A foto não pertence a esta obra e a este dia.' }
    }
    const { data: foto, error: erroFoto } = await supabase.storage
      .from('obras-fotos')
      .info(entrada.fotoPath)
    if (erroFoto || !foto || foto.contentType !== 'image/jpeg' ||
        typeof foto.size !== 'number' || foto.size > TAMANHO_MAXIMO_FOTO) {
      return { error: 'A foto precisa ser JPEG e ter até 5 MB. Dá para salvar sem ela.' }
    }
  }

  // Um registro por obra por dia — o banco tem `unique (obra_id, data)`.
  // Responder de novo é CORRIGIR a resposta de hoje, não um erro de duplicata.
  const { error: erroDiario } = await supabase.from('obras_diario').upsert(
    {
      obra_id: obra.id,
      data: dia,
      andou: entrada.andou,
      motivo: motivo || null,
      item,
      obs: obs || null,
      foto_path: entrada.fotoPath || null,
      registrado_por: user.id,
    },
    { onConflict: 'obra_id,data' }
  )
  if (erroDiario) return { error: 'Erro ao salvar o diário' }

  await recalcularContadores(supabase, obra.id)

  const erroTarefa = await abrirTarefas(supabase, obra, {
    dia,
    hora,
    item,
    obs,
    temFoto: !!entrada.fotoPath,
    registrou: await resolverChave(supabase, user.email),
  })
  if (erroTarefa) return { error: erroTarefa }

  revalidatePath('/obras/diario')
  revalidatePath('/obras/tarefas')
  return { success: true }
}

/**
 * A REGRA CENTRAL DO MÓDULO.
 *
 * Duas faltas diferentes podem sair de uma única resposta, e as duas viram
 * tarefa:
 *   1. o item que faltou (Material, Ferramenta, Equipe, Documento / ART, Outro)
 *      → dono pela `ROTA_FALTA`: Material vai para Compras, o resto para o Yuri;
 *   2. a FOTO QUE NÃO VEIO numa obra em campo → dono é a EQUIPE da obra, que é
 *      quem está lá. A ausência da foto é o que dispara a cobrança — pedido
 *      explícito do cliente, não inferência nossa.
 *
 * Idempotente de propósito: salvar de novo não duplica tarefa. As tarefas
 * abertas hoje para esta obra que não correspondem mais à resposta são
 * apagadas (o analista corrigiu de "faltou material" para "não faltou"), e as
 * que já existem para o mesmo item são deixadas em paz.
 */
async function abrirTarefas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  obra: ObraMinima,
  ctx: {
    dia: string
    hora: string
    item: string
    obs: string
    temFoto: boolean
    registrou: string
  }
): Promise<string | null> {
  const querem: string[] = []
  if (ctx.item !== NAO_FALTOU) querem.push(ctx.item)
  if (pedeFoto(obra) && !ctx.temFoto) querem.push(ITEM_FOTO)

  const { data: existentes, error: erroLer } = await supabase
    .from('obras_tarefa')
    .select('id, item, situacao')
    .eq('obra_id', obra.id)
    .eq('aberta', ctx.dia)
  if (erroLer) return 'Erro ao abrir a tarefa da falta'

  const jaAbertas: { id: string; item: string; situacao: string }[] = existentes ?? []

  // Tarefa órfã de uma falta que não existe mais é pior que tarefa nenhuma.
  const sobrando = jaAbertas
    .filter((t) => t.situacao !== 'respondida' && !querem.includes(t.item))
    .map((t) => t.id)
  if (sobrando.length) {
    await supabase.from('obras_tarefa').delete().in('id', sobrando)
  }

  const novos = querem.filter((it) => !jaAbertas.some((t) => t.item === it))
  if (!novos.length) return null

  const linhas = novos
    .map((it) => {
      const rota = destinoDe(it)
      if (!rota) return null
      const dono = rota.chave === CHAVE_EQUIPE ? chaveDaEquipe(obra) : rota.chave
      return {
        obra_id: obra.id,
        item: it,
        dono,
        aberta: ctx.dia,
        hora_aberta: ctx.hora,
        prazo: prazoPadrao(ctx.dia, ctx.hora),
        registrou: ctx.registrou || null,
        situacao: 'aberta' as const,
        // `resumo` é o que a PESSOA COBRADA escreve ao responder. A observação
        // que o analista digitou no diário NÃO cabe aqui: gravá-la em `resumo`
        // faria a resposta apagar o contexto que a gerou. `obras_tarefa` não
        // tem coluna para essa observação — está reportado como lacuna do
        // schema; hoje ela vive em `obras_diario.obs` e aparece na ficha.
        resumo: null,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  if (!linhas.length) return null

  const { error } = await supabase.from('obras_tarefa').insert(linhas)
  if (error) return 'Erro ao abrir a tarefa da falta'
  return null
}

/**
 * Desfazer: tira a obra da lista "Já respondidas" e a devolve para a fila.
 *
 * A RPC apaga na mesma transação as tarefas AINDA ABERTAS que a resposta de
 * hoje gerou. Tarefa já respondida fica: alguém trabalhou nela.
 */
export async function desfazerDiarioAction(obraId: string): Promise<EstadoDiario> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }

  const dia = hojeISO()

  const { error } = await supabase.rpc('obras_desfazer_diario', {
    p_obra_id: obraId,
    p_dia: dia,
  })
  if (error) return { error: 'Erro ao desfazer o registro de hoje' }

  // Desfazer também desconta: sem isto a obra continuaria "3 dias sem andar"
  // por causa de uma resposta que não existe mais.
  await recalcularContadores(supabase, obraId)

  revalidatePath('/obras/diario')
  revalidatePath('/obras/tarefas')
  return { success: true }
}

/**
 * URL assinada e curta para ver a foto do dia. O bucket `obras-fotos` é
 * PRIVADO: sem esta action não há como exibir nada, e é assim de propósito —
 * link de foto de obra não pode circular fora do sistema.
 */
export async function obterUrlFotoAction(path: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }

  const { data, error } = await supabase.storage.from('obras-fotos').createSignedUrl(path, 60)
  if (error || !data?.signedUrl) return { error: 'Não deu para abrir a foto' }
  return { url: data.signedUrl }
}

/**
 * Recalcula `nao_andou_seguidos`, `bloqueada_dias` e `bloqueio` a partir do
 * histórico do diário da obra.
 *
 * Por que recalcular em vez de incrementar: responder de novo no mesmo dia é
 * CORRIGIR a resposta de hoje (o diário tem `unique (obra_id, data)`), e um
 * `+1` cego contaria a mesma falta duas vezes. O histórico é a única fonte
 * honesta. 60 registros cobrem quase três meses de dias úteis — mais que isso
 * não muda contador nenhum, porque qualquer sequência real quebra antes.
 *
 * Falha aqui NÃO derruba o salvamento: o registro do dia já está gravado, e
 * perder o registro para consertar um contador seria trocar o certo pelo enfeite.
 */
async function recalcularContadores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  obraId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('obras_diario')
    .select('andou, motivo')
    .eq('obra_id', obraId)
    .order('data', { ascending: false })
    .limit(60)
  if (error) return

  await supabase
    .from('obras_obra')
    .update(contadoresDoDiario((data ?? []) as RegistroDiario[]))
    .eq('id', obraId)
}
