'use server'

/**
 * Execução da sincronização. Só esta camada toca Field e Supabase; a decisão
 * fica em `_sincronizacao.ts`. Toda leitura termina antes da primeira escrita,
 * porque uma fotografia parcial nunca pode virar evidência de ausência.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { criarClienteField } from '../_lib/field'
import type { OpcoesDaVarredura } from '../_lib/field'
import {
  emLotes,
  encontrarConsultasDeReabertura,
  planejarSincronizacao,
  type HistoricoHerdado,
  type NumeroDeOsAlterado,
  type ObraExistente,
  type OsIgnorada,
  type VerificacaoDeReabertura,
} from './_sincronizacao'

const TAMANHO_DO_LOTE = 100
const TAMANHO_DA_PAGINA = 1000
const COLUNAS_DA_RECONCILIACAO =
  'id, os, loja, descricao, fonte, field_id, field_ausente_desde, field_ausente_em'

export type RelatorioSincronizacao = {
  totalDoField: number
  novas: number
  atualizadas: number
  inalteradas: number
  suspeitasDeAusencia: number
  novosAlertasDeAusencia: number
  alertasRemovidos: number
  numerosDeOsAlterados: NumeroDeOsAlterado[]
  historicosHerdados: HistoricoHerdado[]
  ignoradas: OsIgnorada[]
  avisos: string[]
}

export type EstadoSincronizacao = { error?: string; relatorio?: RelatorioSincronizacao }

function mensagemDeFalha(erro: unknown): string {
  if (erro instanceof Error && erro.message) {
    return `Não deu para puxar as OS do Field Control. ${erro.message}`
  }
  return 'Não deu para puxar as OS do Field Control. Tente de novo em alguns minutos.'
}

/** Lê a tabela inteira, em páginas estáveis. O fim da paginação é obrigatório. */
async function lerTodasAsObras(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ obras?: ObraExistente[]; error?: string }> {
  const obras: ObraExistente[] = []
  for (let inicio = 0; ; inicio += TAMANHO_DA_PAGINA) {
    const { data, error } = await supabase
      .from('obras_obra')
      .select(COLUNAS_DA_RECONCILIACAO)
      .order('id', { ascending: true })
      .range(inicio, inicio + TAMANHO_DA_PAGINA - 1)

    if (error) return { error: `Não deu para ler as obras já cadastradas: ${error.message}` }
    const pagina = (data ?? []) as ObraExistente[]
    obras.push(...pagina)
    if (pagina.length < TAMANHO_DA_PAGINA) return { obras }
  }
}

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

  const chaveApi = (process.env.FIELD_API_KEY ?? '').trim()
  if (!chaveApi) {
    return {
      error:
        'A chave da API do Field Control não está configurada no servidor. ' +
        'Defina FIELD_API_KEY no ambiente do app (EasyPanel → Environment, no formato NOME=valor numa linha só) e refaça o deploy.',
    }
  }

  // D3 preencherá `desde`; a autorização para inferir ausência nasce desta
  // mesma opção, sem uma flag independente que alguém possa esquecer ligada.
  const opcoesDaVarredura: OpcoesDaVarredura = {}
  const clienteField = criarClienteField({ chaveApi })
  let doField
  try {
    doField = await clienteField.listarOsNormalizadas(opcoesDaVarredura)
  } catch (erro) {
    return { error: mensagemDeFalha(erro) }
  }

  const leitura = await lerTodasAsObras(supabase)
  if (leitura.error) return { error: leitura.error }

  const verificacoesDeReabertura: VerificacaoDeReabertura[] = []
  for (const consulta of encontrarConsultasDeReabertura(doField, leitura.obras ?? [])) {
    try {
      const resultado = await clienteField.consultarSituacaoDaOrdem(consulta.idFieldAnterior)
      verificacoesDeReabertura.push({ ...consulta, situacao: resultado.situacao })
    } catch {
      // A função do cliente já converte falhas em inconclusivo; esta guarda
      // protege também contra transporte injetado ou regressão inesperada.
      verificacoesDeReabertura.push({ ...consulta, situacao: 'inconclusiva' })
    }
  }

  const plano = planejarSincronizacao(doField, leitura.obras ?? [], {
    varreduraCompleta: opcoesDaVarredura.desde === undefined,
    agora: new Date().toISOString(),
    verificacoesDeReabertura,
  })
  const ignoradas: OsIgnorada[] = [...plano.ignoradas]

  let novas = 0
  for (const lote of emLotes(plano.inserir, TAMANHO_DO_LOTE)) {
    const { error } = await supabase.from('obras_obra').insert(lote)
    if (error) return { error: `Erro ao criar as obras novas: ${error.message}` }
    novas += lote.length
  }

  let atualizadas = 0
  let alertasRemovidos = 0
  const historicosHerdados: HistoricoHerdado[] = []
  const idsAtualizados = new Set<string>()
  for (const alvo of plano.atualizar) {
    const { error } = await supabase.from('obras_obra').update(alvo.campos).eq('id', alvo.id)
    if (error) {
      ignoradas.push({
        os: alvo.os,
        idField: alvo.id,
        motivo: `erro ao atualizar a OS ${alvo.os}: ${error.message}`,
      })
      continue
    }
    idsAtualizados.add(alvo.id)
    if (alvo.removeAlerta) alertasRemovidos++
    if (alvo.historicoHerdado) historicosHerdados.push(alvo.historicoHerdado)
    atualizadas++
  }

  let suspeitasDeAusencia = 0
  let novosAlertasDeAusencia = 0
  for (const alvo of plano.reconciliarAusencias) {
    const { error } = await supabase.from('obras_obra').update(alvo.campos).eq('id', alvo.id)
    if (error) {
      ignoradas.push({
        os: alvo.os,
        idField: alvo.idField,
        motivo: `erro ao registrar ausência da OS ${alvo.os ?? '—'}: ${error.message}`,
      })
      continue
    }
    if (alvo.acao === 'suspeita') suspeitasDeAusencia++
    else novosAlertasDeAusencia++
  }

  revalidatePath('/obras/base')
  revalidatePath('/obras/diario')

  return {
    relatorio: {
      totalDoField: plano.totalDoField,
      novas,
      atualizadas,
      inalteradas: plano.inalteradas,
      suspeitasDeAusencia,
      novosAlertasDeAusencia,
      alertasRemovidos,
      numerosDeOsAlterados: plano.numerosDeOsAlterados.filter((item) =>
        idsAtualizados.has(item.obraId),
      ),
      historicosHerdados,
      ignoradas,
      avisos: plano.avisos,
    },
  }
}
