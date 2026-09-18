#!/usr/bin/env node
/**
 * Exporta para Excel a lista de OS "Atividade Spot" não arquivada que a
 * PRIMEIRA CARGA do Controle de Obras importaria do Field Control.
 *
 * O FILTRO, A QUERY E A PAGINAÇÃO SÃO OS MESMOS DA SINCRONIZAÇÃO REAL — não
 * um critério inventado por este script:
 *
 *   - Filtro: `service_id:"<id de Atividade Spot>"`, exatamente como
 *     `app/obras/_lib/field/cliente.ts` monta em `listarOsNormalizadas`
 *     (linha 178: `const filtros: FiltroQ[] = [{ campo: 'service_id', valor: serviceId }]`).
 *     Nenhum filtro de `updated_at` entra: a primeira carga é do tipo
 *     'completa' (`app/obras/sincronizar/_execucao.ts`, `executarExecucaoPreparada`,
 *     linha 188-189 — `opcoesDaVarredura.desde` só é setado quando
 *     `execucao.desde` existe, e `execucao.desde` só existe para
 *     `tipo === 'incremental'`, ver `_execucao.ts` linha 140).
 *   - `sort=id`, `limit=100` por página, `offset` incremental — mesmos valores
 *     padrão de `criarClienteField` (`cliente.ts` linhas 131-133) e mesmo laço
 *     de paginação (`cliente.ts` linhas 189-226), incluindo a detecção de
 *     página repetida e o teto de offset.
 *   - "Loja" pela estratégia padrão `'localizacao'` (`cliente.ts` linha 148,
 *     `config.estrategiaDeLoja ?? 'localizacao'` — é o que `_execucao.ts` usa,
 *     que não passa `estrategiaDeLoja`), ou seja o NOME da localização vinda de
 *     `/locations/:id`, não o endereço. Mudou em 16/09/2026 (commit 6272343), a
 *     pedido do cliente: ele espera 'DP LEBLON 6', não 'AV ATAULFO DE PAIVA, 319'.
 *
 * A ÚNICA COISA QUE ESTE SCRIPT FAZ A MAIS QUE A SINCRONIZAÇÃO: chama
 * `GET /orders/:id/tasks` para cada OS, porque `OsNormalizada` (o formato que
 * sai de `_lib/field/`) não carrega status/atividade nem `createdAt` — só
 * o que a sincronização grava no banco. Por isso este script NÃO usa
 * `cliente.listarOsNormalizadas()`: ele reproduz o mesmo filtro/paginação de
 * `/orders` diretamente com `http.get`, para poder ler `createdAt` (que a
 * normalização descarta) e depois complementa com as atividades.
 *
 * RITMO DAS CHAMADAS: a tarefa pediu uma pausa de ~200ms entre chamadas.
 * Este script usa em vez disso o MESMO limitador de 1 req/s que a
 * sincronização usa (`_lib/field/limitador.ts`, compartilhado por todo
 * `http.get`), porque 200ms violaria o rate limit documentado (1 req/s) e
 * geraria 429 em cadeia. O limitador já serializa as chamadas, já espera o
 * necessário entre elas e já tenta de novo com backoff em caso de 429
 * (`http.ts`) — é estritamente mais seguro que 200ms fixos, e é a mesma
 * política que o app usa em produção.
 *
 * SÓ LEITURA: nenhuma chamada aqui é POST/PUT/PATCH/DELETE.
 *
 * USO: node scripts/exportar-os-field.mjs
 * A chave vem de FIELD_API_KEY no ambiente ou de .env.local na raiz — nunca é
 * impressa neste script.
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import ExcelJS from 'exceljs'

const RAIZ_DO_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CAMINHO_ENV_LOCAL = path.join(RAIZ_DO_PROJETO, '.env.local')
const CAMINHO_SAIDA = path.join(
  RAIZ_DO_PROJETO,
  'docs',
  'cliente',
  '2026-08-31-sistema-controle-de-obras',
  'entregas',
  'os-field-atividade-spot-2026-09-15.xlsx',
)

// ---------------------------------------------------------------------------
// Loader mínimo para o Node conseguir importar os .ts de `_lib/field/` sem
// build — mesma técnica de `scripts/verificar-field.mjs`, copiada literal.
// ---------------------------------------------------------------------------
const FONTE_DO_RESOLVEDOR = `
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const EXTENSOES = ['.ts', '.tsx', '.mts', '.js', '.mjs']

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (erro) {
    const podeTentarDeNovo =
      erro && erro.code === 'ERR_MODULE_NOT_FOUND' && context.parentURL && specifier.startsWith('.')
    if (!podeTentarDeNovo) throw erro

    const base = fileURLToPath(new URL(specifier, context.parentURL))
    for (const ext of EXTENSOES) {
      if (existsSync(base + ext)) return nextResolve(specifier + ext, context)
    }
    const comoIndice = path.join(base, 'index')
    for (const ext of EXTENSOES) {
      if (existsSync(comoIndice + ext)) {
        return nextResolve(specifier.replace(/\\/?$/, '/index' + ext), context)
      }
    }
    throw erro
  }
}
`
register('data:text/javascript,' + encodeURIComponent(FONTE_DO_RESOLVEDOR), import.meta.url)

// ---------------------------------------------------------------------------
// Chave — nunca impressa, nunca gravada.
// ---------------------------------------------------------------------------
function localizarChave() {
  if (typeof process.env.FIELD_API_KEY === 'string' && process.env.FIELD_API_KEY.trim() !== '') {
    return process.env.FIELD_API_KEY.trim()
  }
  if (!existsSync(CAMINHO_ENV_LOCAL)) {
    throw new Error('FIELD_API_KEY não encontrada: nem no ambiente, nem em .env.local.')
  }
  const conteudo = readFileSync(CAMINHO_ENV_LOCAL, 'utf8')
  const linhas = conteudo.split(/\r\n|\r|\n/)
  for (const linhaBruta of linhas) {
    const semEspaco = linhaBruta.replace(/^[ \t]+/, '')
    if (semEspaco.startsWith('FIELD_API_KEY=')) {
      let valor = semEspaco.slice('FIELD_API_KEY='.length).trim()
      if (
        (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
        (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
      ) {
        valor = valor.slice(1, -1)
      }
      if (valor) return valor
    }
  }
  throw new Error('FIELD_API_KEY não encontrada em .env.local.')
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------
function paraDdMmAaaa(valorIso) {
  if (!valorIso) return ''
  const instante = Date.parse(valorIso)
  if (!Number.isFinite(instante)) return ''
  const data = new Date(instante)
  const dd = String(data.getUTCDate()).padStart(2, '0')
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  const aaaa = data.getUTCFullYear()
  return `${dd}/${mm}/${aaaa}`
}

// ---------------------------------------------------------------------------
// Paginação de /orders — cópia fiel do laço de `cliente.ts` (linhas 185-226),
// só que devolvendo o item CRU (com `createdAt`), não `OsNormalizada`.
// ---------------------------------------------------------------------------
async function listarOrdensCru(http, { montarQ, serviceId, tamanhoDaPagina, offsetMaximo }) {
  const q = montarQ([{ campo: 'service_id', valor: serviceId }])
  const ordens = []
  let offset = 0
  const primeirosIdsVistos = new Set()

  for (;;) {
    const pagina = await http.get('/orders', { q, limit: tamanhoDaPagina, offset, sort: 'id' })
    if (!pagina || !Array.isArray(pagina.items)) {
      throw new Error('Field Control devolveu uma página de /orders sem items. Interrompido.')
    }
    const itens = pagina.items
    const primeiroId = itens[0]?.id ?? null
    if (primeiroId && primeirosIdsVistos.has(primeiroId)) {
      throw new Error(`Field Control repetiu a página de /orders no offset ${offset}. Interrompido.`)
    }
    if (primeiroId) primeirosIdsVistos.add(primeiroId)
    ordens.push(...itens)

    if (itens.length < tamanhoDaPagina) break
    offset += tamanhoDaPagina
    if (offset > offsetMaximo) {
      throw new Error(`Varredura passou do offset máximo (${offsetMaximo}) documentado.`)
    }
  }
  return ordens
}

// ---------------------------------------------------------------------------
// Atividades de uma OS (GET /orders/:id/tasks) — paginado defensivamente com
// o mesmo estilo (limit/offset), já que a doc pública não cobre este
// endpoint. Na prática observada, o envelope tem {items, totalCount} igual a
// /orders, e os items vêm ordenados por `position` crescente.
// ---------------------------------------------------------------------------
async function listarAtividadesCru(http, idDaOrdem, tamanhoDaPagina) {
  const atividades = []
  let offset = 0
  for (;;) {
    const pagina = await http.get(`/orders/${encodeURIComponent(idDaOrdem)}/tasks`, {
      limit: tamanhoDaPagina,
      offset,
    })
    const itens = Array.isArray(pagina?.items) ? pagina.items : []
    atividades.push(...itens)
    if (itens.length < tamanhoDaPagina) break
    offset += tamanhoDaPagina
    if (offset > 5000) break // teto de segurança; nunca visto na prática
  }
  return atividades
}

/** A "última atividade" é a de maior `position`; empate desfeito por updatedAt. */
function ultimaAtividade(atividades) {
  if (atividades.length === 0) return null
  return [...atividades].sort((a, b) => {
    const posA = typeof a.position === 'number' ? a.position : -Infinity
    const posB = typeof b.position === 'number' ? b.position : -Infinity
    if (posA !== posB) return posB - posA
    const uA = Date.parse(a.updatedAt ?? '') || 0
    const uB = Date.parse(b.updatedAt ?? '') || 0
    return uB - uA
  })[0]
}

function statusDaAtividade(atividade) {
  if (!atividade) return ''
  return atividade.statusClassification?.description ?? atividade.statusDescription ?? atividade.status ?? ''
}

function dataDaAtividade(atividade) {
  if (!atividade) return ''
  const candidata =
    atividade.completedAt ?? atividade.startedAt ?? atividade.scheduling?.date ?? atividade.updatedAt ?? atividade.createdAt ?? null
  return paraDdMmAaaa(candidata)
}

async function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const chaveApi = localizarChave()

  const field = await import(new URL('../app/obras/_lib/field/index.ts', import.meta.url).href)
  const {
    criarHttpField,
    criarClienteField,
    montarQ,
    textoDoEndereco,
    NOME_PADRAO_DO_TIPO_DE_OS,
    TAMANHO_MAXIMO_DA_PAGINA,
    OFFSET_MAXIMO,
  } = field

  const http = criarHttpField({ chaveApi })
  const cliente = criarClienteField({ chaveApi, http })

  console.log(`Resolvendo o id do tipo de OS "${NOME_PADRAO_DO_TIPO_DE_OS}"...`)
  const serviceId = await cliente.resolverIdDoTipoDeOs()

  console.log('Varrendo /orders com o filtro e a paginação da sincronização...')
  const ordensCru = await listarOrdensCru(http, {
    montarQ,
    serviceId,
    tamanhoDaPagina: TAMANHO_MAXIMO_DA_PAGINA,
    offsetMaximo: OFFSET_MAXIMO,
  })
  console.log(`Total de OS "Atividade Spot" trazidas pela varredura: ${ordensCru.length}`)

  const arquivadas = ordensCru.filter((o) => o.archived === true)
  if (arquivadas.length > 0) {
    console.log(
      `ATENÇÃO: ${arquivadas.length} OS vieram com archived=true dentro da listagem filtrada por service_id ` +
        '— ou seja, a listagem NÃO exclui arquivadas sozinha. Confira o relatório.',
    )
  }

  // Ordenação por número da OS. Na prática `identifier` nem sempre é
  // numérico puro (há OS com prefixo/sufixo alfanumérico, ex. "0126-013004",
  // "VISA108", "TESTE SPOT"), então um comparador que às vezes compara como
  // número e às vezes como texto quebra a transitividade e produz ordem
  // inconsistente. Um único comparador — `localeCompare` com `numeric: true`
  // — é comparação de texto em todos os pares, mas trata dígitos embutidos
  // de forma natural (ex. "OS2" antes de "OS10"), e é consistente para as
  // 185 OS reais, que são majoritariamente alfanuméricas.
  const colator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
  const ordensOrdenadas = [...ordensCru].sort((a, b) => colator.compare(String(a.identifier), String(b.identifier)))

  const linhas = []
  const anomalias = []
  let processadas = 0

  for (const ordem of ordensOrdenadas) {
    const loja = textoDoEndereco(ordem.address)
    if (!loja) anomalias.push(`OS ${ordem.identifier}: sem loja/endereço.`)

    const atividades = await listarAtividadesCru(http, ordem.id, 100)
    if (atividades.length === 0) anomalias.push(`OS ${ordem.identifier}: sem nenhuma atividade.`)
    const ultima = ultimaAtividade(atividades)

    linhas.push({
      os: ordem.identifier,
      loja: loja ?? '',
      descricao: ordem.description ?? '',
      statusUltimaAtividade: statusDaAtividade(ultima),
      dataUltimaAtividade: dataDaAtividade(ultima),
      quantidadeAtividades: atividades.length,
      dataCriacao: paraDdMmAaaa(ordem.createdAt ?? null),
    })

    processadas += 1
    if (processadas % 25 === 0) {
      console.log(`  ${processadas}/${ordensOrdenadas.length} OS processadas (atividades lidas)...`)
    }
  }

  // ---------------------------------------------------------------------
  // Excel
  // ---------------------------------------------------------------------
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Hub Manfac — Controle de Obras'
  workbook.created = new Date()

  const aba = workbook.addWorksheet('OS no Field')
  aba.columns = [
    { header: 'Nº da OS', key: 'os', width: 12 },
    { header: 'Loja', key: 'loja', width: 42 },
    { header: 'Descrição', key: 'descricao', width: 50 },
    { header: 'Status da última atividade', key: 'statusUltimaAtividade', width: 24 },
    { header: 'Data da última atividade', key: 'dataUltimaAtividade', width: 20 },
    { header: 'Quantidade de atividades', key: 'quantidadeAtividades', width: 20 },
    { header: 'Data de criação da OS', key: 'dataCriacao', width: 18 },
    { header: 'É obra para acompanhar? (S/N)', key: 'ehObra', width: 26 },
    { header: 'Observação', key: 'observacao', width: 40 },
  ]
  aba.getRow(1).font = { bold: true }
  aba.views = [{ state: 'frozen', ySplit: 1 }]

  for (const linha of linhas) {
    aba.addRow({
      os: linha.os,
      loja: linha.loja,
      descricao: linha.descricao,
      statusUltimaAtividade: linha.statusUltimaAtividade,
      dataUltimaAtividade: linha.dataUltimaAtividade,
      quantidadeAtividades: linha.quantidadeAtividades,
      dataCriacao: linha.dataCriacao,
      ehObra: '',
      observacao: '',
    })
  }

  const ultimaColuna = 'I'
  const ultimaLinha = linhas.length + 1
  aba.autoFilter = `A1:${ultimaColuna}1`
  // amplia a área "usada" para o autofiltro cobrir os dados, não só o cabeçalho
  aba.autoFilter = { from: 'A1', to: `${ultimaColuna}${ultimaLinha}` }

  mkdirSync(path.dirname(CAMINHO_SAIDA), { recursive: true })
  await workbook.xlsx.writeFile(CAMINHO_SAIDA)

  console.log('')
  console.log(`Excel gerado: ${CAMINHO_SAIDA}`)
  console.log(`Total de linhas (OS): ${linhas.length}`)
  if (anomalias.length > 0) {
    console.log('')
    console.log('Anomalias encontradas:')
    for (const a of anomalias) console.log(`  - ${a}`)
  }
}

main().catch((erro) => {
  console.error('')
  console.error('ERRO:', erro?.message ?? String(erro))
  process.exitCode = 1
})
