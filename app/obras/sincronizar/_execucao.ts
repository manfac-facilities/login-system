/**
 * Uma única execução para os dois porteiros: botão e pg_cron.
 *
 * A autoria muda (usuário ou service role), mas a leitura do Field, o plano e
 * as escritas são os mesmos. Duplicar esta função para a rota automática faria
 * os dois caminhos divergirem justamente nas regras que protegem histórico.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarClienteField, type OpcoesDaVarredura, type OsNormalizada } from '../_lib/field'
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
const MARGEM_INCREMENTAL_MS = 10 * 60 * 1000
const EXPIRACAO_DA_TRAVA_MS = 2 * 60 * 60 * 1000
const COLUNAS_DA_RECONCILIACAO =
  'id, os, loja, descricao, fonte, field_id, field_ausente_desde, field_ausente_em'

// A tipagem gerada do banco ainda não existe neste projeto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BancoObras = SupabaseClient<any, any, any>
export type TipoDeSincronizacao = 'completa' | 'incremental'
export type OrigemDaSincronizacao = 'agendada' | 'botao'

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

export type EstadoSincronizacao = {
  error?: string
  relatorio?: RelatorioSincronizacao
  execucaoId?: string
  jaEstavaRodando?: boolean
}

export type ExecucaoPreparada = {
  id: string
  tipo: TipoDeSincronizacao
  origem: OrigemDaSincronizacao
  marcaDaguaAnterior: string | null
  desde?: string
}

type Preparacao =
  | { execucao: ExecucaoPreparada; jaEstavaRodando?: never }
  | { execucao?: never; jaEstavaRodando: true }

function mensagemDeFalha(erro: unknown): string {
  if (erro instanceof Error && erro.message) {
    return `Não deu para puxar as OS do Field Control. ${erro.message}`
  }
  return 'Não deu para puxar as OS do Field Control. Tente de novo em alguns minutos.'
}

function maiorMarcaDagua(anterior: string | null, ordens: OsNormalizada[]): string | null {
  let maior = anterior && Number.isFinite(Date.parse(anterior)) ? anterior : null
  for (const ordem of ordens) {
    const candidata = ordem.atualizadoEm
    if (!candidata || !Number.isFinite(Date.parse(candidata))) continue
    if (!maior || Date.parse(candidata) > Date.parse(maior)) maior = candidata
  }
  return maior
}

function desdeComMargem(marca: string | null): string | undefined {
  if (!marca) return undefined
  const instante = Date.parse(marca)
  if (!Number.isFinite(instante)) return undefined
  return new Date(instante - MARGEM_INCREMENTAL_MS).toISOString()
}

/** Lê a tabela inteira, em páginas estáveis. O fim da paginação é obrigatório. */
async function lerTodasAsObras(
  supabase: BancoObras,
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

export async function prepararExecucao(
  supabase: BancoObras,
  entrada: {
    tipo: TipoDeSincronizacao
    origem: OrigemDaSincronizacao
    criadoPor: string | null
    agora?: Date
  },
): Promise<Preparacao> {
  const agora = entrada.agora ?? new Date()
  const expiraAntes = new Date(agora.getTime() - EXPIRACAO_DA_TRAVA_MS).toISOString()
  const { data, error } = await supabase.rpc('obras_iniciar_sync_execucao', {
    p_tipo: entrada.tipo,
    p_origem: entrada.origem,
    p_criado_por: entrada.criadoPor,
    p_expira_antes: expiraAntes,
  })
  if (error) throw new Error(`Não deu para registrar o início da sincronização: ${error.message}`)

  const linha = Array.isArray(data) ? data[0] : null
  if (!linha?.execucao_id) return { jaEstavaRodando: true }
  const marcaDaguaAnterior = linha.marca_dagua_anterior ?? null
  return {
    execucao: {
      id: linha.execucao_id,
      tipo: entrada.tipo,
      origem: entrada.origem,
      marcaDaguaAnterior,
      desde: entrada.tipo === 'incremental' ? desdeComMargem(marcaDaguaAnterior) : undefined,
    },
  }
}

function contagens(relatorio?: RelatorioSincronizacao) {
  return {
    total_field: relatorio?.totalDoField ?? 0,
    novas: relatorio?.novas ?? 0,
    atualizadas: relatorio?.atualizadas ?? 0,
    inalteradas: relatorio?.inalteradas ?? 0,
    ignoradas: relatorio?.ignoradas.length ?? 0,
    suspeitas_ausencia: relatorio?.suspeitasDeAusencia ?? 0,
    novos_alertas_ausencia: relatorio?.novosAlertasDeAusencia ?? 0,
    alertas_removidos: relatorio?.alertasRemovidos ?? 0,
    numeros_os_alterados: relatorio?.numerosDeOsAlterados.length ?? 0,
    historicos_herdados: relatorio?.historicosHerdados.length ?? 0,
    avisos: relatorio?.avisos.length ?? 0,
  }
}

async function finalizarExecucao(
  supabase: BancoObras,
  execucao: ExecucaoPreparada,
  estado: { status: 'sucesso' | 'falhou'; erro?: string; relatorio?: RelatorioSincronizacao; marca?: string | null },
): Promise<string | null> {
  const { error } = await supabase
    .from('obras_sync_execucao')
    .update({
      status: estado.status,
      finalizada_em: new Date().toISOString(),
      erro: estado.erro ?? null,
      marca_dagua_nova: estado.status === 'sucesso' ? estado.marca ?? null : null,
      ...contagens(estado.relatorio),
    })
    .eq('id', execucao.id)
  return error ? error.message : null
}

export async function executarExecucaoPreparada(
  supabase: BancoObras,
  execucao: ExecucaoPreparada,
): Promise<EstadoSincronizacao> {
  let relatorio: RelatorioSincronizacao | undefined
  try {
    const chaveApi = (process.env.FIELD_API_KEY ?? '').trim()
    if (!chaveApi) throw new Error('FIELD_API_KEY não está configurada no servidor')

    const opcoesDaVarredura: OpcoesDaVarredura = {}
    if (execucao.desde) opcoesDaVarredura.desde = execucao.desde
    const clienteField = criarClienteField({ chaveApi })
    const doField = await clienteField.listarOsNormalizadas(opcoesDaVarredura)

    const leitura = await lerTodasAsObras(supabase)
    if (leitura.error) throw new Error(leitura.error)

    const verificacoesDeReabertura: VerificacaoDeReabertura[] = []
    for (const consulta of encontrarConsultasDeReabertura(doField, leitura.obras ?? [])) {
      try {
        const resultado = await clienteField.consultarSituacaoDaOrdem(consulta.idFieldAnterior)
        verificacoesDeReabertura.push({ ...consulta, ...resultado })
      } catch {
        verificacoesDeReabertura.push({
          ...consulta,
          situacao: 'inconclusiva',
          motivo: 'falha inesperada ao consultar a ordem antiga',
        })
      }
    }

    // O tipo da execução é a autoridade para ausência. Uma incremental sem
    // marca ainda lê tudo para criar a primeira marca, mas nunca usa essa
    // leitura inaugural como prova negativa contra obras existentes.
    const plano = planejarSincronizacao(doField, leitura.obras ?? [], {
      varreduraCompleta: execucao.tipo === 'completa',
      agora: new Date().toISOString(),
      verificacoesDeReabertura,
    })
    const ignoradas: OsIgnorada[] = [...plano.ignoradas]
    relatorio = {
      totalDoField: plano.totalDoField,
      novas: 0,
      atualizadas: 0,
      inalteradas: plano.inalteradas,
      suspeitasDeAusencia: 0,
      novosAlertasDeAusencia: 0,
      alertasRemovidos: 0,
      numerosDeOsAlterados: [],
      historicosHerdados: [],
      ignoradas,
      avisos: plano.avisos,
    }

    for (const lote of emLotes(plano.inserir, TAMANHO_DO_LOTE)) {
      const { error } = await supabase.from('obras_obra').insert(lote)
      if (error) throw new Error(`Erro ao criar as obras novas: ${error.message}`)
      relatorio.novas += lote.length
    }

    let houveFalhaDeGravacao = false
    const idsAtualizados = new Set<string>()
    for (const alvo of plano.atualizar) {
      const { error } = await supabase.from('obras_obra').update(alvo.campos).eq('id', alvo.id)
      if (error) {
        houveFalhaDeGravacao = true
        ignoradas.push({
          os: alvo.os,
          idField: alvo.id,
          motivo: `erro ao atualizar a OS ${alvo.os}: ${error.message}`,
        })
        continue
      }
      idsAtualizados.add(alvo.id)
      if (alvo.removeAlerta) relatorio.alertasRemovidos++
      if (alvo.historicoHerdado) relatorio.historicosHerdados.push(alvo.historicoHerdado)
      relatorio.atualizadas++
    }

    for (const alvo of plano.reconciliarAusencias) {
      const { error } = await supabase.from('obras_obra').update(alvo.campos).eq('id', alvo.id)
      if (error) {
        houveFalhaDeGravacao = true
        ignoradas.push({
          os: alvo.os,
          idField: alvo.idField,
          motivo: `erro ao registrar ausência da OS ${alvo.os ?? '—'}: ${error.message}`,
        })
        continue
      }
      if (alvo.acao === 'suspeita') relatorio.suspeitasDeAusencia++
      else relatorio.novosAlertasDeAusencia++
    }

    relatorio.numerosDeOsAlterados = plano.numerosDeOsAlterados.filter((item) =>
      idsAtualizados.has(item.obraId),
    )

    if (houveFalhaDeGravacao) {
      throw new Error('Uma ou mais obras não puderam ser gravadas; a marca d’água não avançou')
    }

    const marca = maiorMarcaDagua(execucao.marcaDaguaAnterior, doField)
    const erroAoFinalizar = await finalizarExecucao(supabase, execucao, {
      status: 'sucesso',
      relatorio,
      marca,
    })
    if (erroAoFinalizar) {
      return {
        error: `A sincronização terminou, mas o status não pôde ser gravado: ${erroAoFinalizar}`,
        relatorio,
        execucaoId: execucao.id,
      }
    }

    revalidatePath('/obras/base')
    revalidatePath('/obras/diario')
    revalidatePath('/obras/sincronizar')
    return { relatorio, execucaoId: execucao.id }
  } catch (erro) {
    const mensagem = mensagemDeFalha(erro)
    const erroAoFinalizar = await finalizarExecucao(supabase, execucao, {
      status: 'falhou',
      erro: mensagem,
      relatorio,
    })
    return {
      error: erroAoFinalizar
        ? `${mensagem} Também não foi possível gravar o status: ${erroAoFinalizar}`
        : mensagem,
      relatorio,
      execucaoId: execucao.id,
    }
  }
}

export async function executarSincronizacao(
  supabase: BancoObras,
  entrada: {
    tipo: TipoDeSincronizacao
    origem: OrigemDaSincronizacao
    criadoPor: string | null
    agora?: Date
  },
): Promise<EstadoSincronizacao> {
  try {
    const preparacao = await prepararExecucao(supabase, entrada)
    if (preparacao.jaEstavaRodando) {
      return {
        error: 'Já existe uma sincronização em andamento. Aguarde a conclusão.',
        jaEstavaRodando: true,
      }
    }
    return executarExecucaoPreparada(supabase, preparacao.execucao)
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : 'Não foi possível iniciar a sincronização.' }
  }
}
