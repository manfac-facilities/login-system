/**
 * Importação da planilha de revisões — funções puras, usadas no navegador (prévia) e na
 * action (revalidação com dados do banco). Sem import de servidor.
 * Spec: docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md §2.
 */
import { formatarKm } from './revisaoStatus'

export const MAX_LINHAS = 2000
export const MAX_BYTES = 2 * 1024 * 1024

export type CampoImportacao = 'placa' | 'km' | 'data' | 'oficina' | 'valor' | 'pecas' | 'obs' | 'ign'

export const CAMPOS_IMPORTACAO: [CampoImportacao, string][] = [
  ['placa', 'Placa'], ['km', 'KM da revisão'], ['data', 'Data'], ['oficina', 'Oficina'], ['valor', 'Valor'],
  ['pecas', 'Peças trocadas'], ['obs', 'Observações'], ['ign', '(ignorar)'],
]

/** Cabeçalhos da planilha modelo ("Baixar modelo"). */
export const CABECALHOS_MODELO = ['Placa', 'KM', 'Data', 'Oficina', 'Valor', 'Peças trocadas', 'Observações']

/** Ordem fixa usada para reenviar as linhas já lidas à action (ver `paraCelulas`). */
export const MAPA_GRAVACAO: CampoImportacao[] = ['placa', 'km', 'data', 'oficina', 'valor', 'pecas', 'obs']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const REGRAS: [CampoImportacao, (h: string) => boolean][] = [
  ['placa', (h) => h.includes('placa')],
  ['km', (h) => h.includes('km')],
  ['data', (h) => h.includes('data')],
  ['oficina', (h) => h.includes('oficina') || h.includes('fornecedor')],
  ['valor', (h) => h.includes('valor')],
  ['pecas', (h) => h.includes('peca')],
  ['obs', (h) => h.includes('obs')],
]

export function sugerirMapeamento(cabecalhos: string[]): CampoImportacao[] {
  const usados = new Set<CampoImportacao>()
  return cabecalhos.map((c) => {
    const h = norm(String(c ?? ''))
    const achou = REGRAS.find(([campo, teste]) => !usados.has(campo) && teste(h))
    if (!achou) return 'ign'
    usados.add(achou[0])
    return achou[0]
  })
}

export function mapeamentoValido(mapa: CampoImportacao[]): boolean {
  const reais: CampoImportacao[] = mapa.filter((m) => m !== 'ign')
  if (new Set(reais).size !== reais.length) return false
  return (['placa', 'km', 'data'] as CampoImportacao[]).every((c) => reais.includes(c))
}

/** CSV UTF-8 com `;` ou `,` (o que mais aparece no cabeçalho), aspas duplas e "" como escape. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const cab = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (cab.match(/;/g)?.length ?? 0) > (cab.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); linhas.push(linha); linha = []; campo = ''
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

export function normalizarPlaca(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[\s-]/g, '')
}

const texto = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim())

/** Aceita `30.050`, `30050`, `30050,0` e número da célula. Inteiro ≥ 0 ou null. */
export function lerKm(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null
  const s = texto(v).replace(/\s/g, '')
  let n: number
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'))
  else if (/^\d+(,\d+)?$/.test(s)) n = Number(s.replace(',', '.'))
  else if (/^\d+\.\d{1,2}$/.test(s)) n = Number(s)
  else return null
  return Number.isFinite(n) ? Math.round(n) : null
}

const dataValida = (a: number, m: number, d: number): string | null => {
  const x = new Date(Date.UTC(a, m - 1, d))
  if (x.getUTCFullYear() !== a || x.getUTCMonth() !== m - 1 || x.getUTCDate() !== d) return null
  return x.toISOString().slice(0, 10)
}

/** `dd/mm/aaaa`, `aaaa-mm-dd` (com ou sem hora), data da célula Excel ou número de série do Excel. */
export function lerData(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 1) return null
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
  }
  const s = texto(v)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return dataValida(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (m) return dataValida(+m[1], +m[2], +m[3])
  return null
}

/** Aceita `1.234,56`, `R$ 380,00` e número. Vazio ou ilegível → null (o valor é opcional). */
export function lerValor(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
  let s = texto(v).replace(/R\$/i, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Math.round(Number(s) * 100) / 100
}

export interface ContextoImportacao {
  hoje: string
  veiculos: { id: string; placa: string; km_atual: number; intervalo_revisao_km: number | null }[]
  existentes: { veiculo_id: string; km_realizada: number | null }[]
}

export type ResultadoImportacao = 'ok' | 'aviso' | 'erro' | 'dup'

export interface LinhaImportada {
  /** número da linha na planilha (cabeçalho = 1) */
  linha: number
  placa: string
  /** KM como veio na planilha (para o relatório) */
  kmTexto: string
  km: number | null
  data: string | null
  oficina: string | null
  valor: number | null
  pecas: string | null
  obs: string | null
  veiculo_id: string | null
  resultado: ResultadoImportacao
  motivo: string
}

const opc = (v: unknown) => texto(v) || null

/** `linhas` sem o cabeçalho; `mapa[i]` diz o que é a coluna i. */
export function validarLinhas(linhas: unknown[][], mapa: CampoImportacao[], ctx: ContextoImportacao): LinhaImportada[] {
  const porPlaca = new Map(ctx.veiculos.map((v) => [normalizarPlaca(v.placa), v]))
  const vistos = new Set(ctx.existentes.filter((e) => e.km_realizada != null).map((e) => `${e.veiculo_id}|${Number(e.km_realizada)}`))
  const col = (c: CampoImportacao) => mapa.indexOf(c)
  const out: LinhaImportada[] = []

  linhas.forEach((cel, i) => {
    const pega = (c: CampoImportacao): unknown => (col(c) >= 0 ? cel[col(c)] : undefined)
    if (mapa.every((m, j) => m === 'ign' || texto(cel[j]) === '')) return

    const placa = normalizarPlaca(pega('placa'))
    const kmTexto = texto(pega('km'))
    const km = lerKm(pega('km'))
    const data = lerData(pega('data'))
    const v = porPlaca.get(placa)
    const base = {
      linha: i + 2, placa, kmTexto, km, data,
      oficina: opc(pega('oficina')), valor: lerValor(pega('valor')), pecas: opc(pega('pecas')), obs: opc(pega('obs')),
      veiculo_id: v?.id ?? null,
    }
    const r = (resultado: ResultadoImportacao, motivo: string) => out.push({ ...base, resultado, motivo })

    if (!v) return r('erro', 'Placa não cadastrada')
    if (km == null) return r('erro', `KM inválido ("${kmTexto}")`)
    if (!data) return r('erro', 'Data inválida')
    if (data > ctx.hoje) return r('erro', 'Data no futuro')
    const chave = `${v.id}|${km}`
    if (vistos.has(chave)) return r('dup', 'Já existe (mesma placa e KM): ignorada')
    vistos.add(chave)
    if (km > Number(v.km_atual)) return r('aviso', `KM maior que o atual do carro (${formatarKm(Number(v.km_atual))}): conferir`)
    r('ok', 'Pronta para importar')
  })
  return out
}

export function contar(rs: LinhaImportada[]) {
  const n = (k: ResultadoImportacao) => rs.filter((r) => r.resultado === k).length
  return { ok: n('ok'), aviso: n('aviso'), erro: n('erro'), dup: n('dup') }
}

export function linhasParaGravar(rs: LinhaImportada[], incluirAvisos: boolean): LinhaImportada[] {
  return rs.filter((r) => r.resultado === 'ok' || (incluirAvisos && r.resultado === 'aviso'))
}

/** Linha já lida → células na ordem de `MAPA_GRAVACAO`, para a action revalidar. */
export function paraCelulas(r: LinhaImportada): unknown[] {
  return [r.placa, r.km, r.data, r.oficina, r.valor, r.pecas, r.obs]
}
