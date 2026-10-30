/**
 * Filtro, ordenação, paginação e leitura de query string das bases (funções puras).
 */
import { colunasDa } from './colunas'
import type {
  AbastLinha, BaseId, FiltrosBase, KmLinha, Linha, MotLinha, VeicLinha,
} from './tipos'
import { FILTROS_VAZIOS } from './tipos'

export const POR_PAGINA = 20

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ehData = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function textoBusca(base: BaseId, r: Linha): string {
  if (base === 'abast') {
    const a = r as AbastLinha
    return [a.placa, a.modelo, a.posto, a.motorista, a.equipe].join(' ')
  }
  if (base === 'km') {
    const k = r as KmLinha
    return [k.placa, k.motorista, k.equipe, k.obs].join(' ')
  }
  if (base === 'mot') {
    const m = r as MotLinha
    return [m.nome, m.equipe, m.cnh, m.contato].join(' ')
  }
  const v = r as VeicLinha
  return [v.placa, v.modelo, v.equipe, v.motorista].join(' ')
}

export function filtrarLinhas<R extends Linha>(base: BaseId, rows: R[], f: FiltrosBase): R[] {
  const q = semAcento(f.q.trim())
  return rows.filter((r) => {
    if (q && !semAcento(textoBusca(base, r)).includes(q)) return false
    if (base === 'abast' || base === 'km') {
      const x = r as unknown as AbastLinha | KmLinha
      if (f.de && x.data < f.de) return false
      if (f.ate && x.data > f.ate) return false
      if (f.equipe && x.equipe !== f.equipe) return false
      if (f.placa && x.placa !== f.placa) return false
      if (f.motorista && x.motorista !== f.motorista) return false
      return true
    }
    if (base === 'mot') {
      const m = r as unknown as MotLinha
      if (f.equipe && m.equipe !== f.equipe) return false
      if (f.situacao === 'ativo' && !m.ativo) return false
      if (f.situacao === 'inativo' && m.ativo) return false
      if (f.cnh === 'vencida' && m.cnhClasse !== 'vencida') return false
      if (f.cnh === 'vencendo' && m.cnhClasse !== 'vencendo') return false
      if (f.cnh === 'alerta' && m.cnhClasse !== 'vencida' && m.cnhClasse !== 'vencendo') return false
      return true
    }
    const v = r as unknown as VeicLinha
    if (f.equipe && v.equipe !== f.equipe) return false
    if (f.placa && v.placa !== f.placa) return false
    if (f.sit && v.sit !== f.sit) return false
    return true
  })
}

export interface Ordem { k: string; dir: 1 | -1 }

/** Estável; vazio (null) sempre no fim, qualquer que seja a direção. */
export function ordenarLinhas<R extends Linha>(base: BaseId, rows: R[], ordem: Ordem | null): R[] {
  if (!ordem) return rows
  const col = colunasDa(base).find((c) => c.k === ordem.k)
  if (!col) return rows
  const cmp = new Intl.Collator('pt-BR', { numeric: true })
  return rows
    .map((r, i) => ({ r, i, v: col.sort(r) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === ''
      const bn = b.v === null || b.v === ''
      if (an || bn) return an && bn ? a.i - b.i : an ? 1 : -1
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : cmp.compare(String(a.v), String(b.v))
      return c * ordem.dir || a.i - b.i
    })
    .map((x) => x.r)
}

export function paginar<T>(rows: T[], pagina: number, por = POR_PAGINA) {
  const total = Math.max(1, Math.ceil(rows.length / por))
  const p = Math.min(Math.max(1, Math.floor(pagina) || 1), total)
  return { pagina: p, totalPaginas: total, itens: rows.slice((p - 1) * por, p * por), de: rows.length ? (p - 1) * por + 1 : 0, ate: Math.min(p * por, rows.length) }
}

// ---------------------------------------------------------------- query string

type Params = Record<string, string | string[] | undefined>
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const CHAVES_FILTRO = ['q', 'busca', 'de', 'ate', 'equipe', 'placa', 'motorista', 'situacao', 'cnh', 'sit', 'status']

/**
 * Filtros iniciais a partir da URL. Parâmetros por base:
 *  abast/km: q, de, ate (AAAA-MM-DD), equipe (código), placa, motorista (nome)
 *  mot:      q, equipe, situacao (ativo|inativo), cnh (alerta|vencendo|vencida)
 *  veic:     q, equipe, placa, sit (uso|livre|oficina|fora); legado status=manutencao|inativo
 * Sem nenhum parâmetro de filtro, abast/km mostram o mês corrente (de = dia 1, ate = hoje);
 * com algum parâmetro, de/ate ausentes não limitam. Valor inválido é ignorado.
 */
export function filtrosDaUrl(base: BaseId, params: Params, hoje: string): FiltrosBase {
  const f: FiltrosBase = { ...FILTROS_VAZIOS }
  f.q = (um(params.q) || um(params.busca)).slice(0, 80)
  f.equipe = um(params.equipe)
  f.placa = um(params.placa)
  f.motorista = um(params.motorista)
  const de = um(params.de), ate = um(params.ate)
  if (ehData(de)) f.de = de
  if (ehData(ate)) f.ate = ate
  const situacao = um(params.situacao)
  if (situacao === 'ativo' || situacao === 'inativo') f.situacao = situacao
  const cnh = um(params.cnh)
  if (cnh === 'alerta' || cnh === 'vencendo' || cnh === 'vencida') f.cnh = cnh
  let sit = um(params.sit)
  if (!sit) {
    const status = um(params.status)
    if (status === 'manutencao') sit = 'oficina'
    else if (status === 'inativo') sit = 'fora'
  }
  if (sit === 'uso' || sit === 'livre' || sit === 'oficina' || sit === 'fora') f.sit = sit

  const semFiltro = !CHAVES_FILTRO.some((k) => um(params[k]) !== '')
  if ((base === 'abast' || base === 'km') && semFiltro) {
    f.de = `${hoje.slice(0, 7)}-01`
    f.ate = hoje
  }
  return f
}

export function descreverFiltros(base: BaseId, f: FiltrosBase): string {
  const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
  const p: string[] = []
  if (base === 'abast' || base === 'km') p.push(`período ${f.de ? br(f.de) : 'início'} a ${f.ate ? br(f.ate) : 'hoje'}`)
  if (f.equipe) p.push(`equipe ${f.equipe}`)
  if (f.placa) p.push(`placa ${f.placa}`)
  if (f.motorista) p.push(`motorista ${f.motorista}`)
  if (f.situacao) p.push(f.situacao === 'ativo' ? 'só ativos' : 'só inativos')
  if (f.cnh) p.push({ vencendo: 'CNH vencendo em 60 dias', vencida: 'CNH vencida', alerta: 'CNH vencida ou vencendo' }[f.cnh] ?? '')
  if (f.sit) p.push(`situação: ${({ uso: 'em uso', livre: 'livre', oficina: 'na oficina', fora: 'fora da frota' } as Record<string, string>)[f.sit]}`)
  if (f.q) p.push(`busca "${f.q}"`)
  return p.length ? p.join(' · ') : 'sem filtro (tudo)'
}
