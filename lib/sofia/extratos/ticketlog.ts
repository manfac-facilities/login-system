import ExcelJS from 'exceljs'
import {
  codigoNumerico,
  dataIso,
  decimalDeNumero,
  decimalDeTexto,
  decimalInformativo,
  horaValida,
  normalizar,
  semRepeticao,
} from './comum'
import { ErroExtrato, type LinhaExtrato } from './tipos'

const ABA = 'Transações'

/**
 * Colunas usadas do .xlsx da Ticketlog (aba "Transações", cabeçalho na
 * linha 1). PLACA não é lida: na amostra de outubro todas as 206 transações
 * vieram com a mesma placa. NOME MOTORISTA, MATRICULA e RESPONSAVEL também
 * não (dado pessoal).
 */
const OBRIGATORIAS = {
  codigo: 'CODIGO TRANSACAO',
  data: 'DATA TRANSACAO',
  cartao: 'NUMERO CARTAO',
  valor: 'VALOR EMISSAO',
  servico: 'SERVICO',
} as const
const OPCIONAIS = {
  litros: 'LITROS',
  valorLitro: 'VL/LITRO',
  hodometro: 'HODOMETRO OU HORIMETRO',
  estabelecimento: 'NOME ESTABELECIMENTO',
  cidade: 'CIDADE',
} as const
type Chave = keyof typeof OBRIGATORIAS | keyof typeof OPCIONAIS

/** Valor "cru" da célula: resolve fórmula, rich text e hyperlink. */
function primitivo(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return primitivo(v.result as ExcelJS.CellValue)
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('text' in v) return v.text
    if ('error' in v) return null
  }
  return v
}

function vazio(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

/**
 * Data/hora de uso. O exceljs devolve a data do Excel como Date em UTC com o
 * relógio de parede da planilha (05:17:44 vem como 05:17:44Z) — por isso as
 * partes UTC. Aceita também número serial e texto "dd/mm/aaaa hh:mm[:ss]".
 */
function dataHora(v: unknown): { data: string; hora: string | null } | null {
  let d: Date | null = null
  if (v instanceof Date) d = v
  else if (typeof v === 'number' && Number.isFinite(v)) d = new Date(Math.round((v - 25569) * 86400000))
  if (d) {
    if (Number.isNaN(d.getTime())) return null
    const data = dataIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    const hora = horaValida(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
    return data ? { data, hora } : null
  }
  if (typeof v !== 'string') return null
  const s = v.trim()
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
  const p = br ? [br[3], br[2], br[1], br[4], br[5], br[6]] : iso ? iso.slice(1, 7) : null
  if (!p) return null
  const data = dataIso(Number(p[0]), Number(p[1]), Number(p[2]))
  if (!data) return null
  if (p[3] === undefined) return { data, hora: null }
  const hora = horaValida(Number(p[3]), Number(p[4]), Number(p[5] ?? 0))
  return hora ? { data, hora } : null
}

/** Código/cartão: texto só de dígitos, ou número inteiro exato. */
function codigo(v: unknown): string | null {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? String(v) : null
  return typeof v === 'string' ? codigoNumerico(v) : null
}

function texto(v: unknown): string | null {
  if (vazio(v)) return null
  return String(v).trim()
}

/**
 * Lê o relatório de transações da Ticketlog (.xlsx). Lança ErroExtrato
 * (mensagem para a pessoa) em qualquer problema: entra inteiro ou não entra.
 */
export async function lerTicketlog(arquivo: Uint8Array | ArrayBuffer): Promise<LinhaExtrato[]> {
  const wb = new ExcelJS.Workbook()
  try {
    const buf = arquivo instanceof Uint8Array ? arquivo : new Uint8Array(arquivo)
    // exceljs tipa como Buffer; Uint8Array funciona igual
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
  } catch {
    throw new ErroExtrato('Não deu para ler o arquivo da Ticketlog. Confirme que é o .xlsx baixado da Ticketlog.')
  }

  const ws = wb.worksheets.find((w) => normalizar(w.name) === normalizar(ABA))
  if (!ws) {
    throw new ErroExtrato(
      `A planilha não tem a aba "${ABA}" (abas encontradas: ${wb.worksheets.map((w) => w.name).join(', ') || 'nenhuma'}).`
    )
  }

  const cab = new Map<string, number>()
  ws.getRow(1).eachCell((cell, col) => {
    const t = primitivo(cell.value)
    if (typeof t === 'string') cab.set(normalizar(t), col)
  })
  const idx = {} as Record<Chave, number>
  const faltando: string[] = []
  for (const [chave, nome] of Object.entries({ ...OBRIGATORIAS, ...OPCIONAIS }) as [Chave, string][]) {
    idx[chave] = cab.get(normalizar(nome)) ?? -1
    if (idx[chave] < 0 && chave in OBRIGATORIAS) faltando.push(nome)
  }
  if (faltando.length) {
    throw new ErroExtrato(`A aba "${ws.name}" não tem as colunas ${faltando.join(', ')} na linha 1. Este é o relatório de transações da Ticketlog?`)
  }

  const lidas: { linha: number; dado: LinhaExtrato }[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const v = (k: Chave) => (idx[k] > 0 ? primitivo(row.getCell(idx[k]).value) : null)
    if ((Object.keys(OBRIGATORIAS) as Chave[]).every((k) => vazio(v(k)))) continue
    const erro = (msg: string) => new ErroExtrato(`Linha ${r}: ${msg}`)

    const cod = codigo(v('codigo'))
    if (!cod) throw erro(`CODIGO TRANSACAO inválido ou vazio ("${texto(v('codigo')) ?? ''}").`)
    const quando = dataHora(v('data'))
    if (!quando) throw erro(`DATA TRANSACAO inválida ("${texto(v('data')) ?? ''}").`)
    const cartao = codigo(v('cartao'))
    if (!cartao) throw erro(`NUMERO CARTAO inválido ("${texto(v('cartao')) ?? ''}") — se aparece como 6,03E+15, o arquivo foi salvo pelo Excel; baixe de novo.`)

    const bruto = v('valor')
    const valor =
      typeof bruto === 'number'
        ? decimalDeNumero(bruto, 2)
        : typeof bruto === 'string'
          ? decimalDeTexto(bruto, 2, bruto.includes(',') ? 'br' : 'ponto')
          : null
    if (valor === 'casas') throw erro(`VALOR EMISSAO "${String(bruto)}" tem mais de 2 casas decimais.`)
    if (valor === null) throw erro(`VALOR EMISSAO inválido ou vazio ("${texto(bruto) ?? ''}").`)

    const info = (k: Chave, casas: number) => {
      const x = v(k)
      return decimalInformativo(x, casas, typeof x === 'string' && x.includes(',') ? 'br' : 'ponto')
    }

    lidas.push({
      linha: r,
      dado: {
        codigo_transacao: cod,
        data_uso: quando.data,
        hora_uso: quando.hora,
        identificador: cartao,
        placa: null,
        valor,
        servico: texto(v('servico')),
        tipo_movimento: null,
        litros: info('litros', 3),
        valor_litro: info('valorLitro', 4),
        hodometro: info('hodometro', 1),
        estabelecimento: texto(v('estabelecimento')),
        cidade: texto(v('cidade')),
      },
    })
  }
  if (!lidas.length) throw new ErroExtrato('O arquivo da Ticketlog não tem nenhuma transação.')
  return semRepeticao(lidas, 'CODIGO TRANSACAO')
}
