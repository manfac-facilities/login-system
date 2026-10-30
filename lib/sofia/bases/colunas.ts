/**
 * Colunas da tabela (texto + valor de ordenação) e da planilha de cada base,
 * conforme o mockup aprovado de 30/10/2026 (seções 2.1–2.4).
 */
import { dataBR, fmtBrl, fmtKm, fmtLitros } from '../correcoes'
import type { AbastLinha, BaseId, KmLinha, Linha, MotLinha, SituacaoVeiculo, VeicLinha } from './tipos'

export const SIT_LBL: Record<SituacaoVeiculo, string> = {
  uso: 'Em uso', livre: 'Livre', oficina: 'Na oficina', fora: 'Fora da frota',
}
const SIT_ORDEM: SituacaoVeiculo[] = ['uso', 'livre', 'oficina', 'fora']

const NV = '—'
/** 'dd/mm/aaaa hh:mm' no fuso de São Paulo (nunca o dia UTC). */
export function dataHoraSP(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return `${dataBR(dia)} ${horaSP(iso)}`
}
const dataHora = dataHoraSP
/** HH:MM de São Paulo para um timestamp ISO. */
function horaSP(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

export interface Coluna<R> {
  k: string
  t: string
  /** alinhada à direita (número) */
  r?: boolean
  sort: (r: R) => string | number | null
  texto: (r: R) => string
}

export const COLUNAS_ABAST: Coluna<AbastLinha>[] = [
  { k: 'data', t: 'Data', sort: (r) => r.data, texto: (r) => dataBR(r.data) },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'equipe', t: 'Equipe no dia', sort: (r) => r.equipe, texto: (r) => r.equipe ?? NV },
  { k: 'motorista', t: 'Motorista no dia', sort: (r) => r.motorista, texto: (r) => r.motorista ?? NV },
  { k: 'litros', t: 'Litros', r: true, sort: (r) => r.litros, texto: (r) => (r.litros == null ? NV : fmtLitros(r.litros)) },
  { k: 'valor', t: 'Valor', r: true, sort: (r) => r.valor, texto: (r) => fmtBrl(r.valor) },
  { k: 'preco', t: 'R$ / litro', r: true, sort: (r) => r.preco, texto: (r) => (r.preco == null ? NV : fmtLitros(r.preco)) },
  { k: 'km', t: 'KM no painel', r: true, sort: (r) => r.km, texto: (r) => (r.km == null ? NV : fmtKm(r.km)) },
  { k: 'posto', t: 'Posto', sort: (r) => r.posto, texto: (r) => r.posto ?? NV },
]

export const COLUNAS_KM: Coluna<KmLinha>[] = [
  { k: 'data', t: 'Data', sort: (r) => r.data, texto: (r) => dataBR(r.data) },
  { k: 'equipe', t: 'Equipe', sort: (r) => r.equipe, texto: (r) => r.equipe ?? NV },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'motorista', t: 'Motorista', sort: (r) => r.motorista, texto: (r) => r.motorista ?? NV },
  { k: 'km', t: 'KM informado', r: true, sort: (r) => r.km, texto: (r) => fmtKm(r.km) },
  { k: 'rodado', t: 'Rodou desde o anterior', r: true, sort: (r) => r.rodado, texto: (r) => (r.rodado == null ? NV : `${fmtKm(r.rodado)} km`) },
  { k: 'obs', t: 'Observações', sort: (r) => r.obs, texto: (r) => r.obs ?? NV },
  { k: 'criado', t: 'Lançado em', sort: (r) => r.criado, texto: (r) => dataHora(r.criado) },
]

export const COLUNAS_MOT: Coluna<MotLinha>[] = [
  { k: 'nome', t: 'Nome', sort: (r) => r.nome, texto: (r) => r.nome },
  { k: 'equipe', t: 'Equipe atual', sort: (r) => r.equipe, texto: (r) => r.equipe ?? 'sem equipe' },
  { k: 'cnh', t: 'CNH', sort: (r) => r.cnh, texto: (r) => r.cnh ?? NV },
  { k: 'cnhVenc', t: 'Vencimento da CNH', sort: (r) => r.cnhVenc, texto: (r) => (r.cnhVenc ? dataBR(r.cnhVenc) : NV) },
  { k: 'contato', t: 'Contato', sort: (r) => r.contato, texto: (r) => r.contato ?? NV },
  { k: 'ativo', t: 'Situação', sort: (r) => (r.ativo ? 0 : 1), texto: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
]

export const COLUNAS_VEIC: Coluna<VeicLinha>[] = [
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'modelo', t: 'Modelo', sort: (r) => r.modelo, texto: (r) => r.modelo + (r.ano ? ` ${r.ano}` : '') },
  { k: 'sit', t: 'Situação', sort: (r) => SIT_ORDEM.indexOf(r.sit), texto: (r) => SIT_LBL[r.sit] },
  { k: 'equipe', t: 'Equipe', sort: (r) => r.equipe, texto: (r) => r.equipe ?? NV },
  { k: 'motorista', t: 'Motorista', sort: (r) => r.motorista, texto: (r) => r.motorista ?? NV },
  { k: 'km', t: 'KM atual', r: true, sort: (r) => r.km, texto: (r) => fmtKm(r.km) },
  {
    k: 'kmMes', t: 'Rodou no mês / franquia', r: true, sort: (r) => r.kmMes,
    texto: (r) => (r.kmMes == null ? NV : `${fmtKm(r.kmMes)}${r.franquia == null ? '' : ` / ${fmtKm(r.franquia)}`}`),
  },
  { k: 'locacao', t: 'Locação/mês', r: true, sort: (r) => r.locacao, texto: (r) => (r.locacao == null ? NV : fmtBrl(r.locacao)) },
  { k: 'retorno', t: 'Volta da oficina', sort: (r) => r.retorno, texto: (r) => (r.retorno ? dataBR(r.retorno) : NV) },
]

export const COLUNAS: Record<BaseId, Coluna<never>[]> = {
  abast: COLUNAS_ABAST as Coluna<never>[],
  km: COLUNAS_KM as Coluna<never>[],
  mot: COLUNAS_MOT as Coluna<never>[],
  veic: COLUNAS_VEIC as Coluna<never>[],
}

export function colunasDa(base: BaseId): Coluna<Linha>[] {
  return COLUNAS[base] as unknown as Coluna<Linha>[]
}

export const passouFranquia = (r: VeicLinha) => r.kmMes != null && r.franquia != null && r.kmMes > r.franquia
export const retornoAtrasado = (r: VeicLinha, hoje: string) => r.retorno != null && r.retorno < hoje

// ---------------------------------------------------------------- rodapé

export interface Rodape {
  resumo: string
  /** texto por coluna (k) que tem total */
  colunas: Record<string, string>
}
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

export function rodapeDa(base: BaseId, rows: Linha[]): Rodape {
  if (base === 'abast') {
    const rs = rows as AbastLinha[]
    const litros = rs.reduce((s, r) => s + (r.litros ?? 0), 0)
    const valor = rs.reduce((s, r) => s + r.valor, 0)
    return {
      resumo: `${plural(rs.length, 'abastecimento', 'abastecimentos')} no filtro`,
      colunas: { litros: fmtLitros(litros), valor: fmtBrl(valor), preco: litros > 0 ? fmtLitros(valor / litros) : NV },
    }
  }
  if (base === 'km') {
    const rs = rows as KmLinha[]
    return {
      resumo: `${plural(rs.length, 'lançamento', 'lançamentos')} no filtro`,
      colunas: { rodado: `${fmtKm(rs.reduce((s, r) => s + (r.rodado ?? 0), 0))} km` },
    }
  }
  if (base === 'mot') {
    return { resumo: `${plural(rows.length, 'motorista', 'motoristas')} no filtro`, colunas: {} }
  }
  const rs = rows as VeicLinha[]
  return {
    resumo: `${plural(rs.length, 'veículo', 'veículos')} no filtro`,
    colunas: { locacao: fmtBrl(rs.filter((r) => r.sit !== 'fora').reduce((s, r) => s + (r.locacao ?? 0), 0)) },
  }
}

// ---------------------------------------------------------------- planilha

export type Celula = string | number | Date | null
export interface ColunaExcel<R> {
  t: string
  largura: number
  fmt?: string
  v: (r: R) => Celula
}

export const FMT_DATA = 'dd/mm/yyyy'
export const FMT_DATA_HORA = 'dd/mm/yyyy hh:mm'
export const FMT_MOEDA = '"R$" #,##0.00'
export const FMT_NUM2 = '#,##0.00'
export const FMT_INT = '#,##0'

/** 'AAAA-MM-DD' → Date à meia-noite UTC (o exceljs grava pelo UTC). */
export function dataExcel(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)))
}
/** Timestamp ISO → hora de São Paulo gravada como "hora de parede" em UTC (planilha mostra a hora local). */
export function dataHoraExcel(iso: string): Date | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() - 3 * 3600000)
}
const sn = (b: boolean) => (b ? 'sim' : 'não')

export const EXCEL_ABAST: ColunaExcel<AbastLinha>[] = [
  { t: 'Data', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Modelo', largura: 16, v: (r) => r.modelo || null },
  { t: 'Equipe no dia', largura: 14, v: (r) => r.equipe },
  { t: 'Motorista no dia', largura: 24, v: (r) => r.motorista },
  { t: 'Litros', largura: 10, fmt: FMT_NUM2, v: (r) => r.litros },
  { t: 'Valor (R$)', largura: 13, fmt: FMT_MOEDA, v: (r) => r.valor },
  { t: 'Preço por litro (R$)', largura: 14, fmt: FMT_MOEDA, v: (r) => (r.preco == null ? null : Math.round(r.preco * 100) / 100) },
  { t: 'KM no painel', largura: 12, fmt: FMT_INT, v: (r) => r.km },
  { t: 'Posto', largura: 24, v: (r) => r.posto },
  { t: 'Lançado em', largura: 17, fmt: FMT_DATA_HORA, v: (r) => dataHoraExcel(r.criado) },
  { t: 'Corrigido? (sim/não)', largura: 14, v: (r) => sn(r.corrigido) },
]

export const EXCEL_KM: ColunaExcel<KmLinha>[] = [
  { t: 'Data', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Equipe', largura: 14, v: (r) => r.equipe },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Motorista', largura: 24, v: (r) => r.motorista },
  { t: 'KM informado', largura: 13, fmt: FMT_INT, v: (r) => r.km },
  { t: 'KM rodado desde o lançamento anterior', largura: 18, fmt: FMT_INT, v: (r) => r.rodado },
  { t: 'Observações', largura: 30, v: (r) => r.obs },
  { t: 'Lançado em', largura: 17, fmt: FMT_DATA_HORA, v: (r) => dataHoraExcel(r.criado) },
]

const CNH_TXT = { sem: null, em_dia: 'em dia', vencendo: 'vence em até 60 dias', vencida: 'vencida' } as const
export const EXCEL_MOT: ColunaExcel<MotLinha>[] = [
  { t: 'Nome', largura: 28, v: (r) => r.nome },
  { t: 'Equipe atual', largura: 14, v: (r) => r.equipe },
  { t: 'CNH', largura: 16, v: (r) => r.cnh },
  { t: 'Vencimento da CNH', largura: 14, fmt: FMT_DATA, v: (r) => dataExcel(r.cnhVenc) },
  { t: 'Situação da CNH (em dia / vence em até 60 dias / vencida)', largura: 24, v: (r) => CNH_TXT[r.cnhClasse] },
  { t: 'Contato', largura: 18, v: (r) => r.contato },
  { t: 'Ativo (sim/não)', largura: 10, v: (r) => sn(r.ativo) },
]

const SIT_EXCEL: Record<SituacaoVeiculo, string> = {
  uso: 'em uso', livre: 'livre', oficina: 'na oficina', fora: 'fora da frota',
}
export const EXCEL_VEIC: ColunaExcel<VeicLinha>[] = [
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Modelo', largura: 18, v: (r) => r.modelo },
  { t: 'Ano', largura: 7, v: (r) => r.ano },
  { t: 'Situação (em uso / livre / na oficina / fora da frota)', largura: 22, v: (r) => SIT_EXCEL[r.sit] },
  { t: 'Equipe atual', largura: 14, v: (r) => r.equipe },
  { t: 'Motorista atual', largura: 24, v: (r) => r.motorista },
  { t: 'KM atual', largura: 11, fmt: FMT_INT, v: (r) => r.km },
  { t: 'KM rodado no mês', largura: 13, fmt: FMT_INT, v: (r) => r.kmMes },
  { t: 'Franquia de KM/mês', largura: 13, fmt: FMT_INT, v: (r) => r.franquia },
  { t: 'Valor da locação mensal (R$)', largura: 16, fmt: FMT_MOEDA, v: (r) => r.locacao },
  { t: 'Previsão de volta da oficina', largura: 16, fmt: FMT_DATA, v: (r) => dataExcel(r.retorno) },
  { t: 'Carro substituto', largura: 14, v: (r) => r.substituto },
]

export const EXCEL: Record<BaseId, { aba: string; arquivo: string; colunas: ColunaExcel<never>[] }> = {
  abast: { aba: 'Abastecimentos', arquivo: 'abastecimentos', colunas: EXCEL_ABAST as ColunaExcel<never>[] },
  km: { aba: 'KM diário', arquivo: 'km-diario', colunas: EXCEL_KM as ColunaExcel<never>[] },
  mot: { aba: 'Motoristas', arquivo: 'motoristas', colunas: EXCEL_MOT as ColunaExcel<never>[] },
  veic: { aba: 'Veículos', arquivo: 'veiculos', colunas: EXCEL_VEIC as ColunaExcel<never>[] },
}

export function linhasParaExcel(base: BaseId, rows: Linha[]): Celula[][] {
  const cols = EXCEL[base].colunas as unknown as ColunaExcel<Linha>[]
  return rows.map((r) => cols.map((c) => c.v(r)))
}

/** `frotas-<base>-AAAA-MM-DD.xlsx` */
export function nomeArquivoExcel(base: BaseId, hoje: string): string {
  return `frotas-${EXCEL[base].arquivo}-${hoje}.xlsx`
}
