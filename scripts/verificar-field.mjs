#!/usr/bin/env node
/**
 * Diagnóstico da chave da API do Field Control.
 *
 * O QUE ISTO FAZ: lê `FIELD_API_KEY`, valida o formato sem nunca imprimir o
 * valor, e faz um punhado de chamadas reais (só leitura) para responder quatro
 * perguntas que só uma chamada de verdade resolve:
 *
 *   a) a autenticação funciona?
 *   b) o servidor aceita a codificação do `q` do jeito que a camada monta?
 *   c) `sort=id` é campo de ordenação válido?
 *   d) `updated_at>=` aceita timestamp completo, ou só data?
 *
 * Também reporta quantas OS "Atividade Spot" existem e uma amostra de até 3,
 * com a descrição mascarada (só os 40 primeiros caracteres — é dado de cliente).
 *
 * REGRA ABSOLUTA: a chave nunca é impressa, nem inteira nem em pedaço, nem em
 * mensagem de erro. Só comprimento e sinais de formato.
 *
 * USO: `node scripts/verificar-field.mjs`, a partir da raiz do projeto.
 * A chave vem de `FIELD_API_KEY` no ambiente (se já definida) ou de
 * `FIELD_API_KEY=...` em `.env.local` na raiz.
 *
 * COMO ISTO IMPORTA `app/obras/_lib/field/`, QUE É TYPESCRIPT:
 * Node 24 tira tipos nativamente (sem build), mas os arquivos da camada
 * importam uns aos outros sem extensão (`from './http'`) — forma que o
 * bundler do Next aceita, mas que o resolvedor ESM nativo do Node recusa
 * (`ERR_MODULE_NOT_FOUND`), porque specifier relativo em ESM exige extensão.
 * A saída, testada abaixo antes de escrever o resto do script, foi registrar
 * um loader mínimo (`module.register`) que, só quando a resolução puro-Node
 * falha, tenta de novo com `.ts`/`.tsx`/`.mts`/index.*. Ele não reimplementa
 * nada da camada — só ensina o Node a achar o arquivo do jeito que o Next já
 * acha. Nenhum `fetch` é feito fora de `criarHttpField`/`criarClienteField`;
 * o limitador de 1 req/s da própria camada é o único que corre.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const RAIZ_DO_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CAMINHO_ENV_LOCAL = path.join(RAIZ_DO_PROJETO, '.env.local')

// ---------------------------------------------------------------------------
// Loader mínimo: só resolve extensão que falta em specifier relativo. Nada
// de rede, nada de transformação de código além do que o Node 24 já faz
// nativamente (type-stripping) para arquivos .ts.
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
// Leitura da chave — nunca via Next, nunca impressa.
// ---------------------------------------------------------------------------

/**
 * Acha a chave bruta (ainda não validada) e de onde ela veio.
 * Prioridade: variável de ambiente do processo (é o que o teste com chave
 * falsa usa, de propósito, para nunca escrever no `.env.local`) e só depois
 * o arquivo `.env.local`.
 */
function localizarChaveBruta() {
  if (typeof process.env.FIELD_API_KEY === 'string' && process.env.FIELD_API_KEY !== '') {
    return {
      origem: 'variável de ambiente do processo (FIELD_API_KEY já estava definida no shell)',
      valorBruto: process.env.FIELD_API_KEY,
      suspeitaQuebraDeLinha: false,
      arquivoExiste: existsSync(CAMINHO_ENV_LOCAL),
    }
  }

  const arquivoExiste = existsSync(CAMINHO_ENV_LOCAL)
  if (!arquivoExiste) {
    return { origem: null, valorBruto: null, suspeitaQuebraDeLinha: false, arquivoExiste: false }
  }

  const conteudo = readFileSync(CAMINHO_ENV_LOCAL, 'utf8')
  const linhas = conteudo.split(/\r\n|\r|\n/)

  let ocorrencias = 0
  let encontrada = null

  for (let i = 0; i < linhas.length; i++) {
    const semEspacoInicial = linhas[i].replace(/^[ \t]+/, '')
    if (semEspacoInicial.startsWith('#')) continue
    if (semEspacoInicial.startsWith('FIELD_API_KEY=')) {
      ocorrencias++
      if (encontrada === null) {
        const valorBruto = semEspacoInicial.slice('FIELD_API_KEY='.length)
        const proxima = linhas[i + 1]
        const suspeitaQuebraDeLinha =
          proxima !== undefined &&
          proxima.trim() !== '' &&
          !proxima.trim().startsWith('#') &&
          !/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(proxima.trim())
        encontrada = { linha: i + 1, valorBruto, suspeitaQuebraDeLinha }
      }
    }
  }

  if (!encontrada) {
    return { origem: null, valorBruto: null, suspeitaQuebraDeLinha: false, arquivoExiste: true }
  }

  return {
    origem: `.env.local (linha ${encontrada.linha})`,
    valorBruto: encontrada.valorBruto,
    suspeitaQuebraDeLinha: encontrada.suspeitaQuebraDeLinha,
    arquivoExiste: true,
    ocorrenciasNoArquivo: ocorrencias,
  }
}

/** Só formato — comprimento e sinais de erro de colagem. Nunca o conteúdo. */
function diagnosticarFormato(valorBruto) {
  const espacoNoInicio = /^\s/.test(valorBruto)
  const espacoNoFim = /\s$/.test(valorBruto)
  const semEspacoNasPontas = valorBruto.trim()

  const comecaComAspasDuplas = semEspacoNasPontas.startsWith('"')
  const terminaComAspasDuplas = semEspacoNasPontas.endsWith('"')
  const comecaComAspasSimples = semEspacoNasPontas.startsWith("'")
  const terminaComAspasSimples = semEspacoNasPontas.endsWith("'")

  const aspasDuplasParelhas = comecaComAspasDuplas && terminaComAspasDuplas && semEspacoNasPontas.length >= 2
  const aspasSimplesParelhas = comecaComAspasSimples && terminaComAspasSimples && semEspacoNasPontas.length >= 2
  const aspasDesbalanceadas =
    !aspasDuplasParelhas &&
    !aspasSimplesParelhas &&
    (comecaComAspasDuplas || terminaComAspasDuplas || comecaComAspasSimples || terminaComAspasSimples)

  let valorFinal = semEspacoNasPontas
  let aspasRemovidas = false
  if (aspasDuplasParelhas || aspasSimplesParelhas) {
    valorFinal = semEspacoNasPontas.slice(1, -1)
    aspasRemovidas = true
  }

  const semEspacosInternos = !/\s/.test(valorFinal)
  const tamanhoRazoavel = valorFinal.length >= 16
  const plausivel = valorFinal.length > 0 && semEspacosInternos && tamanhoRazoavel

  return {
    comprimentoBruto: valorBruto.length,
    espacoNoInicio,
    espacoNoFim,
    aspasDetectadas: aspasDuplasParelhas || aspasSimplesParelhas,
    aspasDesbalanceadas,
    aspasRemovidas,
    valorFinal,
    comprimentoFinal: valorFinal.length,
    semEspacosInternos,
    tamanhoRazoavel,
    plausivel,
  }
}

function linha(char = '─', tamanho = 70) {
  return char.repeat(tamanho)
}

function imprimirSecaoFormato(origemInfo, diagnostico) {
  console.log(linha('='))
  console.log('1) LOCALIZAÇÃO E FORMATO DA CHAVE')
  console.log(linha('='))
  console.log(`Origem: ${origemInfo.origem}`)
  if (origemInfo.ocorrenciasNoArquivo && origemInfo.ocorrenciasNoArquivo > 1) {
    console.log(
      `  Atenção: FIELD_API_KEY aparece ${origemInfo.ocorrenciasNoArquivo} vezes no .env.local — usando a primeira ocorrência.`,
    )
  }
  console.log(`Comprimento bruto (como está no arquivo/variável): ${diagnostico.comprimentoBruto} caracteres`)
  console.log(`Espaço sobrando no início: ${diagnostico.espacoNoInicio ? 'SIM' : 'não'}`)
  console.log(`Espaço sobrando no fim: ${diagnostico.espacoNoFim ? 'SIM' : 'não'}`)
  console.log(
    `Aspas envolvendo o valor: ${diagnostico.aspasDetectadas ? `SIM (removidas para o teste)` : 'não'}${
      diagnostico.aspasDesbalanceadas ? ' — ATENÇÃO: aspas desbalanceadas (só de um lado)' : ''
    }`,
  )
  if (origemInfo.suspeitaQuebraDeLinha) {
    console.log(
      '  ATENÇÃO: a linha seguinte no .env.local não parece uma variável nova nem comentário — ' +
        'é possível que a chave tenha quebrado em duas linhas ao colar. Confira no editor sem colar o valor aqui.',
    )
  }
  console.log(`Comprimento final (usado no teste): ${diagnostico.comprimentoFinal} caracteres`)
  console.log(
    `Formato plausível: ${diagnostico.plausivel ? 'sim' : 'NÃO'} ` +
      '(checagem de sanidade só — a API do Field não documenta o formato oficial da chave)',
  )
  if (!diagnostico.semEspacosInternos) {
    console.log('  ATENÇÃO: há espaço NO MEIO do valor — quase certamente colagem quebrada.')
  }
  if (!diagnostico.tamanhoRazoavel) {
    console.log('  ATENÇÃO: comprimento menor que 16 caracteres — parece curto demais para uma chave de API.')
  }
  console.log('')
}

function instrucoesChaveAusente() {
  console.log(linha('='))
  console.log('CHAVE NÃO ENCONTRADA')
  console.log(linha('='))
  console.log('')
  console.log('Não encontrei FIELD_API_KEY nem no ambiente do processo nem no .env.local.')
  console.log('')
  console.log('O que fazer:')
  console.log(`  1. Abra (ou crie) o arquivo: ${CAMINHO_ENV_LOCAL}`)
  console.log('  2. Adicione uma linha exatamente assim (sem aspas, sem espaço nas pontas):')
  console.log('       FIELD_API_KEY=valor-da-chave-aqui')
  console.log('  3. Salve e rode de novo: node scripts/verificar-field.mjs')
  console.log('')
  console.log('O .env.local já está no .gitignore — não precisa (e não deve) ser commitado.')
}

function instrucoesArquivoSemVariavel() {
  console.log(linha('='))
  console.log('CHAVE NÃO ENCONTRADA')
  console.log(linha('='))
  console.log('')
  console.log(`O arquivo ${CAMINHO_ENV_LOCAL} existe, mas não tem uma linha FIELD_API_KEY=...`)
  console.log('')
  console.log('O que fazer:')
  console.log('  1. Abra o .env.local')
  console.log('  2. Adicione uma linha exatamente assim (sem aspas, sem espaço nas pontas):')
  console.log('       FIELD_API_KEY=valor-da-chave-aqui')
  console.log('  3. Salve e rode de novo: node scripts/verificar-field.mjs')
}

// ---------------------------------------------------------------------------
// Chamadas de diagnóstico
// ---------------------------------------------------------------------------

function truncar(valor, tamanho = 500) {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor)
  if (texto === undefined) return String(valor)
  return texto.length > tamanho ? texto.slice(0, tamanho) + '…(truncado)' : texto
}

function mascarar(texto) {
  if (texto === null || texto === undefined) return null
  return texto.length > 40 ? texto.slice(0, 40) + '…(mascarado, resto omitido)' : texto
}

/** Roda uma chamada da camada e devolve um resultado uniforme, sem nunca deixar a exceção estourar. */
async function tentar(descricaoDaTentativa, funcao, { ErroDaApiField, ErroDeTipoDeOs }) {
  try {
    const valor = await funcao()
    return { ok: true, valor, descricaoDaTentativa }
  } catch (erro) {
    if (ErroDeTipoDeOs && erro instanceof ErroDeTipoDeOs) {
      return { ok: false, tipoDeErro: 'ErroDeTipoDeOs', mensagem: erro.message, descricaoDaTentativa }
    }
    if (ErroDaApiField && erro instanceof ErroDaApiField) {
      return {
        ok: false,
        tipoDeErro: erro.name,
        status: erro.status,
        corpo: erro.corpo,
        mensagem: erro.message,
        descricaoDaTentativa,
      }
    }
    // Erro de rede/genérico. Nunca contém a chave: ela só vai no header, nunca na URL nem no corpo.
    return { ok: false, tipoDeErro: 'ErroDeRede', mensagem: erro?.message ?? String(erro), descricaoDaTentativa }
  }
}

function imprimirTentativa(titulo, tentativa, linhaDeVeredito) {
  console.log(`--- ${titulo} ---`)
  console.log(`Tentado: ${tentativa.descricaoDaTentativa}`)
  if (tentativa.ok) {
    console.log('Resposta: HTTP 2xx (sucesso)')
  } else if (tentativa.status !== undefined) {
    console.log(`Resposta: HTTP ${tentativa.status}`)
    if (tentativa.corpo !== undefined && tentativa.corpo !== null) {
      console.log(`Corpo da resposta: ${truncar(tentativa.corpo)}`)
    }
  } else {
    console.log(`Resposta: sem HTTP — ${tentativa.tipoDeErro}: ${tentativa.mensagem}`)
  }
  console.log(`Conclusão: ${linhaDeVeredito}`)
  console.log('')
}

async function main() {
  const origemInfo = localizarChaveBruta()

  if (origemInfo.valorBruto === null) {
    if (!origemInfo.arquivoExiste) {
      instrucoesChaveAusente()
    } else {
      instrucoesArquivoSemVariavel()
    }
    process.exitCode = 1
    return
  }

  const diagnostico = diagnosticarFormato(origemInfo.valorBruto)
  imprimirSecaoFormato(origemInfo, diagnostico)

  if (!diagnostico.plausivel && diagnostico.comprimentoFinal === 0) {
    console.log('A chave ficou vazia depois de tirar espaços/aspas. Não dá para testar. Corrija o .env.local.')
    process.exitCode = 1
    return
  }

  const chaveApi = diagnostico.valorFinal

  // Importa a camada só depois do loader registrado (ver comentário no topo).
  const field = await import(new URL('../app/obras/_lib/field/index.ts', import.meta.url).href)
  const {
    criarHttpField,
    criarClienteField,
    montarQ,
    NOME_PADRAO_DO_TIPO_DE_OS,
    ErroDaApiField,
    ErroDeTipoDeOs,
    textoDoEndereco,
  } = field

  // Um único transporte, para o limitador de 1 req/s ser realmente compartilhado
  // por TODAS as chamadas deste script — inclusive as que usam `http.get`
  // diretamente para os testes b/c/d, que a camada não expõe como método próprio.
  const http = criarHttpField({ chaveApi })
  const cliente = criarClienteField({ chaveApi, http })

  const excecoes = { ErroDaApiField, ErroDeTipoDeOs }

  console.log(linha('='))
  console.log('2) AS QUATRO PERGUNTAS')
  console.log(linha('='))
  console.log('')

  // --- a) Autenticação -------------------------------------------------
  const respostaAuth = await tentar(
    `GET /services?q=name:"${NOME_PADRAO_DO_TIPO_DE_OS}" (header X-Api-Key com a chave)`,
    () => cliente.resolverIdDoTipoDeOs(),
    excecoes,
  )

  let autenticacaoOk = false
  let tipoId = null

  if (respostaAuth.ok) {
    autenticacaoOk = true
    tipoId = respostaAuth.valor
    imprimirTentativa(
      'a) Autenticação',
      respostaAuth,
      `a chave é válida — a API autenticou e devolveu o tipo de OS "${NOME_PADRAO_DO_TIPO_DE_OS}" (id resolvido).`,
    )
  } else if (respostaAuth.tipoDeErro === 'ErroDeTipoDeOs') {
    // Chegou a resposta estruturada da API (não 401/403): a chave autenticou,
    // só o tipo de OS que não pôde ser resolvido para um id único.
    autenticacaoOk = true
    imprimirTentativa(
      'a) Autenticação',
      respostaAuth,
      `a chave é válida — a API respondeu normalmente, mas o tipo "${NOME_PADRAO_DO_TIPO_DE_OS}" não pôde ser resolvido (${respostaAuth.mensagem}). Os testes b/c/d e a amostra de OS ficam pulados por falta de um service_id.`,
    )
  } else if (respostaAuth.status === 401 || respostaAuth.status === 403) {
    imprimirTentativa(
      'a) Autenticação',
      respostaAuth,
      'a chave é INVÁLIDA — a API recusou a autenticação (401/403). Confira o valor no .env.local.',
    )
  } else {
    imprimirTentativa(
      'a) Autenticação',
      respostaAuth,
      `não deu para confirmar — a API respondeu algo inesperado antes de chegar em autenticação/negócio (${respostaAuth.tipoDeErro}).`,
    )
  }

  let respostaBase, respostaSort, respostaDataOnly, respostaTimestampCompleto

  if (autenticacaoOk && tipoId) {
    // --- baseline: equality-quoting simples, sem operador nem sort -------
    respostaBase = await tentar(
      `GET /orders?q=${montarQ([{ campo: 'service_id', valor: tipoId }])}&limit=1 (sem sort, sem operador)`,
      () => http.get('/orders', { q: montarQ([{ campo: 'service_id', valor: tipoId }]), limit: 1 }),
      excecoes,
    )

    // --- c) sort=id --------------------------------------------------
    respostaSort = await tentar(
      `GET /orders?q=${montarQ([{ campo: 'service_id', valor: tipoId }])}&limit=3&sort=id`,
      () =>
        http.get('/orders', {
          q: montarQ([{ campo: 'service_id', valor: tipoId }]),
          limit: 3,
          sort: 'id',
        }),
      excecoes,
    )

    let vereditoSort
    if (respostaSort.ok) {
      vereditoSort = "'sort=id' é aceito pela API."
    } else if (respostaSort.status === 422) {
      vereditoSort = "'sort=id' foi RECUSADO (422) — o campo 'id' não é aceito para ordenação."
    } else {
      vereditoSort = `não deu para confirmar (${respostaSort.tipoDeErro}: ${respostaSort.mensagem}).`
    }
    imprimirTentativa('c) sort=id é campo válido de ordenação?', respostaSort, vereditoSort)

    // --- b) codificação do q com múltiplos filtros e espaço -----------
    const dataAntiga = '2024-02-01'
    respostaDataOnly = await tentar(
      `GET /orders?q=${montarQ([
        { campo: 'service_id', valor: tipoId },
        { campo: 'updated_at', operador: '>=', valor: dataAntiga },
      ])}&limit=1 (dois filtros com espaço entre eles, data sem hora)`,
      () =>
        http.get('/orders', {
          q: montarQ([
            { campo: 'service_id', valor: tipoId },
            { campo: 'updated_at', operador: '>=', valor: dataAntiga },
          ]),
          limit: 1,
        }),
      excecoes,
    )

    let vereditoQ
    if (respostaDataOnly.ok) {
      vereditoQ =
        "a API aceitou o q com dois filtros combinados (igualdade entre aspas + operador sem aspas, espaço codificado como %20)."
    } else if (respostaBase && respostaBase.ok && respostaDataOnly.status === 422) {
      vereditoQ =
        'o filtro simples (só service_id) passou, mas o q combinado com updated_at foi recusado (422) — o problema está na combinação/operador, não na codificação básica.'
    } else if (respostaBase && !respostaBase.ok) {
      vereditoQ = `nem o q mais simples (só service_id) passou — problema anterior à combinação de filtros (${respostaBase.tipoDeErro}: ${respostaBase.mensagem}).`
    } else {
      vereditoQ = `não deu para confirmar (${respostaDataOnly.tipoDeErro}: ${respostaDataOnly.mensagem}).`
    }
    imprimirTentativa('b) o servidor aceita a codificação do q?', respostaDataOnly, vereditoQ)

    // --- d) updated_at>= com timestamp completo -----------------------
    const timestampCompleto = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    respostaTimestampCompleto = await tentar(
      `GET /orders?q=${montarQ([
        { campo: 'service_id', valor: tipoId },
        { campo: 'updated_at', operador: '>=', valor: timestampCompleto },
      ])}&limit=1 (timestamp ISO completo, não só data)`,
      () =>
        http.get('/orders', {
          q: montarQ([
            { campo: 'service_id', valor: tipoId },
            { campo: 'updated_at', operador: '>=', valor: timestampCompleto },
          ]),
          limit: 1,
        }),
      excecoes,
    )

    let vereditoTimestamp
    if (respostaDataOnly.ok && respostaTimestampCompleto.ok) {
      vereditoTimestamp = 'o filtro aceita tanto data pura (2024-02-01) quanto timestamp ISO completo.'
    } else if (respostaDataOnly.ok && !respostaTimestampCompleto.ok) {
      vereditoTimestamp = `só data pura foi aceita — o timestamp completo foi recusado (${respostaTimestampCompleto.tipoDeErro}${
        respostaTimestampCompleto.status ? ' ' + respostaTimestampCompleto.status : ''
      }: ${respostaTimestampCompleto.mensagem}).`
    } else if (!respostaDataOnly.ok && respostaTimestampCompleto.ok) {
      vereditoTimestamp = 'o timestamp completo foi aceito; a data pura é que teve problema (ver pergunta b).'
    } else {
      vereditoTimestamp = 'nenhuma das duas formas pôde ser confirmada — ver os erros de b) acima.'
    }
    imprimirTentativa('d) updated_at>= aceita timestamp completo, ou só data?', respostaTimestampCompleto, vereditoTimestamp)
  } else {
    console.log('--- b), c) e d) ---')
    console.log('Puladas: dependem de um service_id válido, que não foi possível obter (ver pergunta a acima).')
    console.log('')
  }

  // --- item 4: contagem e amostra ---------------------------------------
  console.log(linha('='))
  console.log('3) OS DO TIPO "Atividade Spot"')
  console.log(linha('='))
  console.log('')

  if (autenticacaoOk && tipoId && respostaSort && respostaSort.ok) {
    const envelope = respostaSort.valor
    const total = envelope && typeof envelope.totalCount === 'number' ? envelope.totalCount : null
    const itens = (envelope && envelope.items) || []

    console.log(
      total !== null
        ? `Total de OS do tipo "${NOME_PADRAO_DO_TIPO_DE_OS}": ${total}`
        : `Total de OS do tipo "${NOME_PADRAO_DO_TIPO_DE_OS}": a API não devolveu totalCount nesta resposta.`,
    )
    console.log(`Amostra (até 3, ordenadas por id):`)
    if (itens.length === 0) {
      console.log('  (nenhum item devolvido)')
    }
    for (const ordem of itens.slice(0, 3)) {
      const normalizado = {
        os: ordem.identifier,
        descricao: mascarar(ordem.description ?? null),
        loja: textoDoEndereco(ordem.address),
        idField: ordem.id,
        atualizadoEm: ordem.updatedAt ?? null,
      }
      console.log(`  - ${JSON.stringify(normalizado)}`)
    }
  } else {
    console.log('Não obtido — dependia da pergunta c) ter sucesso (mesma chamada reaproveitada para custar só 1 req/s a mais).')
  }

  console.log('')
  console.log(linha('='))
  console.log('RESUMO')
  console.log(linha('='))
  if (autenticacaoOk) {
    console.log('Funcionou: a chave autentica na API do Field Control.')
  } else {
    console.log('Não funcionou: a chave NÃO autentica. Confira o valor em .env.local e rode de novo.')
  }
  console.log('Detalhes de cada pergunta estão na seção 2 acima.')

  process.exitCode = autenticacaoOk ? 0 : 1
}

main().catch((erroInesperado) => {
  console.log('')
  console.log(linha('='))
  console.log('ERRO INESPERADO NO SCRIPT (não é sobre a chave — é bug do script)')
  console.log(linha('='))
  console.log(erroInesperado?.stack ?? String(erroInesperado))
  process.exitCode = 1
})
