'use server'

/**
 * Importação da planilha do cliente — a carga inicial da base de obras.
 *
 * O parse e a limpeza moram em `_lib/importacao.ts` (funções puras, testadas
 * contra o dump real). Aqui fica só o que precisa do mundo: ler o arquivo,
 * checar quem pode, gravar e contar o que aconteceu.
 *
 * As duas abas entram. A Pipeline cria as obras; a Planejamento enriquece as que
 * estão em campo. Importar só a Planejamento deixaria a base sem nenhuma obra em
 * fechamento ou faturamento — justamente as que motivaram o projeto.
 */

import ExcelJS from 'exceljs'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import {
  localizarAba,
  localizarLinhaCabecalho,
  extrairLinhas,
  montarImportacao,
  camposParaAtualizar,
  type LinhaDescartada,
  type ObraParaImportar,
} from '../_lib/importacao'

const ABA_PIPELINE = 'Pipeline DPSP'
const ABA_PLANEJAMENTO = 'Planejamento DPSP'

/** Nº de colunas de cada aba, conforme o dicionário da planilha. */
const COLS_PIPELINE = 11
const COLS_PLANEJAMENTO = 30

/**
 * Onde começa o dado em cada aba. Procuramos o cabeçalho de verdade e só caímos
 * nestes números se não acharmos — a planilha é editada à mão toda semana, e uma
 * linha inserida no topo moveria tudo em silêncio.
 */
const CABECALHO_PIPELINE_PADRAO = 3
const CABECALHO_PLANEJAMENTO_PADRAO = 4

export type RelatorioImportacao = {
  lidasPipeline: number
  lidasPlanejamento: number
  inseridas: number
  atualizadas: number
  descartadas: LinhaDescartada[]
}

export type EstadoImportacao = { error?: string; relatorio?: RelatorioImportacao }

export async function importarPlanilhaAction(form: FormData): Promise<EstadoImportacao> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  if (!email) return { error: 'Sessão expirada. Entre de novo.' }
  if (!(await isAdmin(supabase, email))) {
    return { error: 'Só administradores podem importar a planilha.' }
  }

  const arquivo = form.get('planilha')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Escolha o arquivo .xlsx da planilha.' }
  }

  // --- Ler a planilha -------------------------------------------------------
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await arquivo.arrayBuffer())
  } catch {
    return { error: 'Não deu para ler o arquivo. Confirme que é um .xlsx válido.' }
  }

  const pipeline = localizarAba(wb, ABA_PIPELINE)
  const planejamento = localizarAba(wb, ABA_PLANEJAMENTO)
  if (!pipeline && !planejamento) {
    return {
      error: `A planilha não tem nenhuma das duas abas esperadas ("${ABA_PIPELINE}" e "${ABA_PLANEJAMENTO}").`,
    }
  }

  const linhasPipeline = pipeline
    ? extrairLinhas(
        pipeline,
        (localizarLinhaCabecalho(pipeline, 1, 'NUM OS') ?? CABECALHO_PIPELINE_PADRAO) + 1,
        COLS_PIPELINE
      )
    : []

  const linhasPlanejamento = planejamento
    ? extrairLinhas(
        planejamento,
        (localizarLinhaCabecalho(planejamento, 1, 'Prioridade') ?? CABECALHO_PLANEJAMENTO_PADRAO) + 1,
        COLS_PLANEJAMENTO
      )
    : []

  const resultado = montarImportacao(linhasPipeline, linhasPlanejamento)
  if (resultado.obras.length === 0) {
    return { error: 'Nenhuma obra encontrada na planilha. Nada foi gravado.' }
  }

  // --- Gravar ---------------------------------------------------------------
  // Idempotência por `os`: quem já existe é atualizado, quem não existe nasce.
  // Atualizar é sempre parcial — ver `camposParaAtualizar`. Reimportar completa e
  // corrige a obra, mas não desfaz a triagem nem a etapa que a equipe moveu na tela.
  // Obra sem OS (a GARANTIA, e o cadastro manual) não tem chave natural — só
  // entra na primeira carga, senão duplicaria a cada importação.
  const { data: existentes, error: erroLeitura } = await supabase
    .from('obras_obra')
    .select('id, os')
    .not('os', 'is', null)

  if (erroLeitura) return { error: 'Não deu para ler as obras já cadastradas.' }

  const idPorOs = new Map<string, string>()
  for (const linha of existentes ?? []) {
    if (linha.os) idPorOs.set(linha.os, linha.id)
  }

  const aInserir: Record<string, unknown>[] = []
  let atualizadas = 0
  const descartadas: LinhaDescartada[] = [...resultado.descartadas]
  const baseVazia = idPorOs.size === 0

  for (const obra of resultado.obras) {
    const campos = paraColunas(obra)
    const idExistente = obra.os ? idPorOs.get(obra.os) : undefined

    if (idExistente) {
      // A planilha preenche e corrige; nunca apaga o que foi digitado no app.
      const atualizacao = camposParaAtualizar(campos)
      if (Object.keys(atualizacao).length === 0) {
        descartadas.push({
          origem: 'pipeline',
          linha: obra.linha,
          motivo: `OS ${obra.os} já cadastrada e a planilha não traz nada novo para ela`,
        })
        continue
      }

      const { error } = await supabase.from('obras_obra').update(atualizacao).eq('id', idExistente)
      if (error) {
        descartadas.push({
          origem: 'pipeline',
          linha: obra.linha,
          motivo: `erro ao atualizar a OS ${obra.os}: ${error.message}`,
        })
      } else {
        atualizadas++
      }
      continue
    }

    if (!obra.os && !baseVazia) {
      descartadas.push({
        origem: 'planejamento',
        linha: obra.linha,
        motivo: 'sem Nº OS — só entra na primeira carga, senão duplicaria a cada importação',
      })
      continue
    }

    aInserir.push(campos)
  }

  // Em lotes: a planilha tem ~190 linhas hoje, mas um insert único de centenas
  // de linhas é o tipo de coisa que funciona no teste e estoura no dia real.
  let inseridas = 0
  for (let i = 0; i < aInserir.length; i += 100) {
    const lote = aInserir.slice(i, i + 100)
    const { error } = await supabase.from('obras_obra').insert(lote)
    if (error) return { error: `Erro ao gravar as obras: ${error.message}` }
    inseridas += lote.length
  }

  revalidatePath('/obras/base')
  revalidatePath('/obras/diario')

  return {
    relatorio: {
      lidasPipeline: resultado.linhasLidasPipeline,
      lidasPlanejamento: resultado.linhasLidasPlanejamento,
      inseridas,
      atualizadas,
      descartadas,
    },
  }
}

/** Tira o `linha` (que é da planilha, não da obra) antes de gravar. */
function paraColunas(obra: ObraParaImportar): Record<string, unknown> {
  const { linha: _linha, ...campos } = obra
  void _linha
  return campos
}
