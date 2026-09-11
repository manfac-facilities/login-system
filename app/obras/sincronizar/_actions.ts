'use server'

/**
 * Sincronização do Field Control com a base de obras.
 *
 * O cliente cadastra a OS no Field Control; esta tela puxa o que ele cadastrou
 * para dentro do hub. É a ponte entre a camada que LÊ a API
 * (`_lib/field/`, pronta e testada) e o banco.
 *
 * A DECISÃO de o que fazer com cada OS mora em `_sincronizacao.ts`, em função
 * pura. Aqui fica só o que precisa do mundo: quem pode rodar, a chave, a
 * leitura do banco, a gravação e a contagem. É o mesmo recorte de
 * `importar/_actions.ts`, e o relatório segue o mesmo formato: toda OS que não
 * entrou aparece com o motivo.
 *
 * NUNCA LANÇA. Falha de rede, chave errada, 500 do Field — tudo vira
 * `{ error }` com texto legível. Server Action que lança derruba a tela inteira
 * com o erro genérico de Server Component, que é o que já aconteceu no hub com
 * a `SUPABASE_SERVICE_ROLE_KEY` (AGENTS.md, "Variáveis de ambiente").
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { criarClienteField } from '../_lib/field'
import {
  emLotes,
  numerosDeOsDoField,
  planejarSincronizacao,
  type ObraExistente,
  type OsIgnorada,
} from './_sincronizacao'

/** Tamanho do `in (...)` de leitura e do `insert` de gravação. */
const TAMANHO_DO_LOTE = 100

export type RelatorioSincronizacao = {
  /** Quantas OS o Field devolveu, antes de qualquer filtro. */
  totalDoField: number
  novas: number
  atualizadas: number
  inalteradas: number
  ignoradas: OsIgnorada[]
}

export type EstadoSincronizacao = { error?: string; relatorio?: RelatorioSincronizacao }

/**
 * Mensagem de erro para o operador, sem vazar segredo.
 *
 * Os erros de `_lib/field/erros.ts` já vêm com texto bom ("Field Control
 * respondeu 500 em GET /orders") e são construídos de propósito sem a chave nem
 * os cabeçalhos. Repassamos a mensagem; qualquer outra coisa vira texto padrão.
 */
function mensagemDeFalha(erro: unknown): string {
  if (erro instanceof Error && erro.message) {
    return `Não deu para puxar as OS do Field Control. ${erro.message}`
  }
  return 'Não deu para puxar as OS do Field Control. Tente de novo em alguns minutos.'
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

  // --- A chave -------------------------------------------------------------
  // Ela é segredo e só chega pelo painel do EasyPanel — o `.env.production`
  // versionado não pode guardá-la. Por isso a falta dela é o erro mais provável
  // no primeiro dia, e tem que ser dita com todas as letras em vez de virar um
  // 401 misterioso do Field.
  const chaveApi = (process.env.FIELD_API_KEY ?? '').trim()
  if (!chaveApi) {
    return {
      error:
        'A chave da API do Field Control não está configurada no servidor. ' +
        'Defina FIELD_API_KEY no ambiente do app (EasyPanel → Environment, no formato NOME=valor numa linha só) e refaça o deploy.',
    }
  }

  // --- Puxar do Field ------------------------------------------------------
  let doField
  try {
    doField = await criarClienteField({ chaveApi }).listarOsNormalizadas()
  } catch (erro) {
    return { error: mensagemDeFalha(erro) }
  }

  if (doField.length === 0) {
    return { relatorio: { totalDoField: 0, novas: 0, atualizadas: 0, inalteradas: 0, ignoradas: [] } }
  }

  // --- Ler o que já existe -------------------------------------------------
  // Só as OS que a varredura mencionou. Ler a base inteira seria mais simples e
  // mais caro a cada mês que ela cresce.
  const existentes: ObraExistente[] = []
  for (const lote of emLotes(numerosDeOsDoField(doField), TAMANHO_DO_LOTE)) {
    const { data, error } = await supabase
      .from('obras_obra')
      .select('id, os, loja, descricao')
      .in('os', lote)

    // Leitura parcial levaria a INSERIR obra que já existe, e o índice único
    // rejeitaria o lote inteiro. Parar aqui, sem gravar nada, é o único
    // desfecho seguro.
    if (error) return { error: `Não deu para ler as obras já cadastradas: ${error.message}` }
    existentes.push(...((data ?? []) as ObraExistente[]))
  }

  const plano = planejarSincronizacao(doField, existentes)
  const ignoradas: OsIgnorada[] = [...plano.ignoradas]

  // --- Gravar --------------------------------------------------------------
  let novas = 0
  for (const lote of emLotes(plano.inserir, TAMANHO_DO_LOTE)) {
    const { error } = await supabase.from('obras_obra').insert(lote)
    if (error) return { error: `Erro ao criar as obras novas: ${error.message}` }
    novas += lote.length
  }

  // Um update por obra: cada uma tem um conjunto diferente de campos vazios, e
  // não existe update em lote com valores distintos. São poucas por varredura —
  // quem já está completa nem chega aqui.
  let atualizadas = 0
  for (const alvo of plano.atualizar) {
    const { error } = await supabase.from('obras_obra').update(alvo.campos).eq('id', alvo.id)
    if (error) {
      // Falha de uma obra não pode abortar a varredura: as outras já entraram.
      // Ela vai para o relatório com o motivo, como na importação da planilha.
      ignoradas.push({
        os: alvo.os,
        idField: alvo.id,
        motivo: `erro ao atualizar a OS ${alvo.os}: ${error.message}`,
      })
      continue
    }
    atualizadas++
  }

  revalidatePath('/obras/base')
  revalidatePath('/obras/diario')

  return {
    relatorio: {
      totalDoField: plano.totalDoField,
      novas,
      atualizadas,
      inalteradas: plano.inalteradas,
      ignoradas,
    },
  }
}
