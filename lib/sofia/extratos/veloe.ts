import {
  codigoNumerico,
  dataBr,
  decimalDeTexto,
  horaTexto,
  normalizar,
  semRepeticao,
} from './comum'
import { ErroExtrato, type LinhaExtrato } from './tipos'

/**
 * Colunas usadas do .csv da Veloe (separador ";", vírgula decimal).
 * Comparação sem acento e sem caixa. "Hora de Untrada" é o nome real (sic);
 * aceitamos também "Hora de Entrada" caso a Veloe corrija.
 * CPF/CNPJ, Razao Social e Informacao 1 (nome do motorista) são ignorados.
 */
const COLUNAS = {
  id: ['ID Transacao'],
  data: ['Data de Utilizacao'],
  hora: ['Hora de Untrada', 'Hora de Entrada'],
  placa: ['Placa'],
  tag: ['VeloeTag'],
  valor: ['Valor Cobrado'],
  movimento: ['Tipo do Movimento'],
  transacao: ['Tipo de Transacao'],
} as const
const OPCIONAIS = { estabelecimento: ['Nome do Estabelecimento'] } as const

type Chave = keyof typeof COLUNAS | keyof typeof OPCIONAIS

function decodificar(bytes: Uint8Array): string {
  let txt: string
  try {
    txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    txt = new TextDecoder('windows-1252').decode(bytes)
  }
  return txt.replace(/^﻿/, '')
}

/** Divide uma linha por ";" respeitando aspas ("a;b" fica inteiro). */
function campos(linha: string): string[] {
  const out: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++ }
      else if (c === '"') aspas = false
      else atual += c
    } else if (c === '"') aspas = true
    else if (c === ';') { out.push(atual); atual = '' }
    else atual += c
  }
  out.push(atual)
  return out
}

/**
 * Lê o extrato pré-pago da Veloe. Lança ErroExtrato (mensagem para a pessoa)
 * em qualquer problema: o arquivo entra inteiro ou não entra.
 */
export function lerVeloe(arquivo: Uint8Array | ArrayBuffer): LinhaExtrato[] {
  const bytes = arquivo instanceof Uint8Array ? arquivo : new Uint8Array(arquivo)
  const linhasTxt = decodificar(bytes).split(/\r?\n/)
  if (!linhasTxt.some((l) => l.trim())) throw new ErroExtrato('O arquivo da Veloe está vazio.')

  const cabecalho = campos(linhasTxt[0]).map(normalizar)
  const idx = {} as Record<Chave, number>
  const faltando: string[] = []
  for (const [chave, nomes] of Object.entries({ ...COLUNAS, ...OPCIONAIS }) as [Chave, readonly string[]][]) {
    const i = cabecalho.findIndex((h) => nomes.some((n) => normalizar(n) === h))
    idx[chave] = i
    if (i < 0 && chave in COLUNAS) faltando.push(nomes[0])
  }
  if (faltando.length) {
    throw new ErroExtrato(
      `Este não parece o extrato da Veloe (.csv separado por ";"): faltam as colunas ${faltando.join(', ')}.`
    )
  }

  const lidas: { linha: number; dado: LinhaExtrato }[] = []
  for (let n = 1; n < linhasTxt.length; n++) {
    const bruto = linhasTxt[n]
    const numLinha = n + 1
    if (!bruto.replace(/;/g, '').trim()) continue
    const c = campos(bruto)
    if (c.length !== cabecalho.length) {
      throw new ErroExtrato(
        `Linha ${numLinha}: tem ${c.length} colunas e o cabeçalho tem ${cabecalho.length}. O arquivo pode ter sido editado no Excel.`
      )
    }
    const v = (k: Chave) => (idx[k] >= 0 ? c[idx[k]].trim() : '')
    const erro = (msg: string) => new ErroExtrato(`Linha ${numLinha}: ${msg}`)

    const codigo = codigoNumerico(v('id'))
    if (!codigo) throw erro(`ID Transacao inválido ("${v('id')}").`)
    const tag = codigoNumerico(v('tag'))
    if (!tag) throw erro(`VeloeTag inválida ("${v('tag')}") — se aparece como 1,00E+09, o arquivo foi salvo pelo Excel; baixe de novo da Veloe.`)
    const data = dataBr(v('data'))
    if (!data) throw erro(`Data de Utilizacao inválida ("${v('data')}").`)
    const hora = v('hora') ? horaTexto(v('hora')) : null
    if (v('hora') && !hora) throw erro(`Hora de entrada inválida ("${v('hora')}").`)

    const movimento = v('movimento')
    if (normalizar(movimento) !== 'debito') {
      throw erro(`Tipo do Movimento "${movimento}" ainda não é tratado (só Debito). Avise o suporte antes de enviar.`)
    }
    const valor = decimalDeTexto(v('valor'), 2, 'br')
    if (valor === 'casas') throw erro(`Valor Cobrado "${v('valor')}" tem mais de 2 casas decimais.`)
    if (valor === null) throw erro(`Valor Cobrado inválido ("${v('valor')}").`)

    lidas.push({
      linha: numLinha,
      dado: {
        codigo_transacao: codigo,
        data_uso: data,
        hora_uso: hora,
        identificador: tag,
        placa: v('placa') || null,
        valor,
        servico: v('transacao') || null,
        tipo_movimento: movimento,
        litros: null,
        valor_litro: null,
        hodometro: null,
        estabelecimento: v('estabelecimento') || null,
        cidade: null,
      },
    })
  }
  if (!lidas.length) throw new ErroExtrato('O arquivo da Veloe não tem nenhuma transação.')
  return semRepeticao(lidas, 'ID Transacao')
}
