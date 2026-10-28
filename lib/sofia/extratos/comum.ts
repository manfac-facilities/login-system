import { ErroExtrato, type LinhaExtrato } from './tipos'

/** "Data de Utilização " -> "data de utilizacao" (sem acento, minúsculo, espaço único). */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Texto decimal -> "1234.56" com `casas` casas, sem passar por float.
 * `formato`:
 *  - 'br': vírgula decimal, ponto só como milhar ("1.234,56", "18,4", "22").
 *    Ponto sem vírgula que não seja milhar ("2.71") é ambíguo -> null.
 *  - 'ponto': "69.99" (texto vindo de célula de planilha).
 * Devolve null se não for número não negativo válido; 'casas' se tiver mais
 * casas do que o permitido (o chamador decide se arredonda ou recusa).
 */
export function decimalDeTexto(
  bruto: string,
  casas: number,
  formato: 'br' | 'ponto'
): string | null | 'casas' {
  const s = bruto.trim()
  let inteiro: string
  let fracao: string
  if (formato === 'br') {
    const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(s)
    if (!m) return null
    inteiro = m[1].replace(/\./g, '')
    fracao = m[2] ?? ''
  } else {
    const m = /^(\d+)(?:\.(\d+))?$/.exec(s)
    if (!m) return null
    inteiro = m[1]
    fracao = m[2] ?? ''
  }
  fracao = fracao.replace(/0+$/, '')
  if (fracao.length > casas) return 'casas'
  inteiro = inteiro.replace(/^0+(?=\d)/, '')
  if (inteiro.length > 10) return null // numeric(12,2): no máximo 10 dígitos inteiros
  return casas === 0 ? inteiro : `${inteiro}.${fracao.padEnd(casas, '0')}`
}

/**
 * Número de célula (float do Excel) -> decimal com `casas`. Só aceita se o
 * número já tiver no máximo `casas` casas (tolerância de ruído de float);
 * caso contrário 'casas'. Negativo ou não finito -> null.
 */
export function decimalDeNumero(n: number, casas: number): string | null | 'casas' {
  if (!Number.isFinite(n) || n < 0) return null
  const fixo = n.toFixed(casas)
  if (Math.abs(Number(fixo) - n) > 1e-9 * Math.max(1, Math.abs(n))) return 'casas'
  return decimalDeTexto(fixo, casas, 'ponto')
}

/** Para campos só de tela (litros, preço por litro, hodômetro): arredonda à escala do banco. */
export function decimalInformativo(v: unknown, casas: number, formato: 'br' | 'ponto'): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return null
    return v.toFixed(casas)
  }
  const s = String(v).trim()
  if (!s) return null
  const n = Number(formato === 'br' ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) && n >= 0 ? n.toFixed(casas) : null
}

export function dataIso(ano: number, mes: number, dia: number): string | null {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function horaValida(h: number, m: number, s: number): string | null {
  if (![h, m, s].every(Number.isInteger) || h > 23 || m > 59 || s > 59 || h < 0 || m < 0 || s < 0) return null
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':')
}

/** "27/10/2026" -> "2026-10-27" */
export function dataBr(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  return m ? dataIso(Number(m[3]), Number(m[2]), Number(m[1])) : null
}

/** "13:38:19" ou "13:38" -> "13:38:19" / "13:38:00" */
export function horaTexto(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim())
  return m ? horaValida(Number(m[1]), Number(m[2]), Number(m[3] ?? 0)) : null
}

/** Identificador/código só com dígitos; pega o estrago do Excel ("1,00E+09"). */
export function codigoNumerico(s: string): string | null {
  const t = s.trim()
  return /^\d+$/.test(t) ? t : null
}

/**
 * Mesmo código de transação duas vezes no arquivo: idêntico conta uma vez;
 * diferente é erro (não dá para saber qual vale, e é dinheiro).
 */
export function semRepeticao(
  linhas: { linha: number; dado: LinhaExtrato }[],
  nomeCodigo: string
): LinhaExtrato[] {
  const vistos = new Map<string, { linha: number; json: string }>()
  const saida: LinhaExtrato[] = []
  for (const { linha, dado } of linhas) {
    const json = JSON.stringify(dado)
    const antes = vistos.get(dado.codigo_transacao)
    if (antes) {
      if (antes.json !== json) {
        throw new ErroExtrato(
          `${nomeCodigo} ${dado.codigo_transacao} aparece nas linhas ${antes.linha} e ${linha} com dados diferentes. Confira o arquivo exportado.`
        )
      }
      continue
    }
    vistos.set(dado.codigo_transacao, { linha, json })
    saida.push(dado)
  }
  return saida
}
