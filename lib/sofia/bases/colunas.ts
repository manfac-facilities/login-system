/**
 * Colunas da tabela (texto + valor de ordenação) e da planilha de cada base,
 * conforme o mockup aprovado de 30/10/2026 (seções 2.1–2.4).
 */
import { dataBR, fmtBrl, fmtKm, fmtLitros } from '../correcoes'
import { ARCA_LBL, STATUS_LBL } from '../manutencoes'
import { DOCUMENTO_TIPO_LABELS } from '../enums'
import { ordemEtapa } from '../multaEtapas'
import {
  AUT_LBL, DOC_SIT_LBL, MULTA_SIT_LBL, REV_SIT_LBL, SIN_SIT_LBL, SIN_TIPO_LBL,
  type AbastLinha, type BaseId, type CorrLinha, type DocLinha, type KmLinha, type Linha, type MotLinha, type MultaLinha,
  type RevLinha, type SinLinha, type SituacaoVeiculo, type VeicLinha,
} from './tipos'

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
  /** quando devolve um tom, a tela mostra o texto como chip dessa cor */
  tom?: (r: R) => Tom | null
}
export type Tom = 'azul' | 'ambar' | 'vermelho' | 'verde' | 'cinza'

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

// ---------------------------------------------------------------- bases de 03/11/2026 (mockup, tela 3)

const REV_SIT_ORDEM = ['atrasada', 'breve', 'dia', 'semprev', 'hist']
const REV_SIT_TOM: Record<RevLinha['sit'], Tom> = { atrasada: 'vermelho', breve: 'ambar', dia: 'verde', semprev: 'cinza', hist: 'cinza' }
const tipoRev = (t: string) => (t === 'corretiva' ? 'Corretiva' : t === 'preventiva' ? 'Preventiva' : t)

export const COLUNAS_REV: Coluna<RevLinha>[] = [
  { k: 'data', t: 'Data feita', sort: (r) => r.data, texto: (r) => (r.data ? dataBR(r.data) : NV) },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'modelo', t: 'Modelo', sort: (r) => r.modelo, texto: (r) => r.modelo || NV },
  { k: 'tipo', t: 'Tipo', sort: (r) => r.tipo, texto: (r) => tipoRev(r.tipo), tom: (r) => (r.tipo === 'corretiva' ? 'ambar' : null) },
  { k: 'oficina', t: 'Oficina', sort: (r) => r.oficina, texto: (r) => r.oficina ?? NV },
  { k: 'km', t: 'KM feita', r: true, sort: (r) => r.km, texto: (r) => (r.km == null ? NV : fmtKm(r.km)) },
  { k: 'valor', t: 'Valor', r: true, sort: (r) => r.valor, texto: (r) => (r.valor == null ? NV : fmtBrl(r.valor)) },
  { k: 'proxKm', t: 'Próxima (KM)', r: true, sort: (r) => r.proxKm, texto: (r) => (r.proxKm == null ? 'sem previsão' : fmtKm(r.proxKm)) },
  { k: 'sit', t: 'Situação', sort: (r) => REV_SIT_ORDEM.indexOf(r.sit), texto: (r) => REV_SIT_LBL[r.sit], tom: (r) => REV_SIT_TOM[r.sit] },
]

const CORR_TOM: Record<CorrLinha['status'], Tom> = { aguardando_orcamento: 'ambar', aguardando_aprovacao: 'ambar', em_conserto: 'vermelho', concluida: 'verde' }
export const COLUNAS_CORR: Coluna<CorrLinha>[] = [
  { k: 'data', t: 'Entrada', sort: (r) => r.data, texto: (r) => dataBR(r.data) },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'defeito', t: 'Defeito', sort: (r) => r.defeito, texto: (r) => r.defeito },
  { k: 'oficina', t: 'Oficina', sort: (r) => r.oficina, texto: (r) => r.oficina ?? NV },
  {
    k: 'saida', t: 'Saída', sort: (r) => r.saida ?? r.saidaPrev,
    texto: (r) => (r.saida ? dataBR(r.saida) : r.saidaPrev ? `prev. ${dataBR(r.saidaPrev)}` : NV),
  },
  { k: 'dias', t: 'Dias parado', r: true, sort: (r) => r.dias, texto: (r) => (r.dias == null ? NV : String(r.dias)) },
  { k: 'custo', t: 'Custo', r: true, sort: (r) => r.custo, texto: (r) => (r.custo == null ? 'a definir' : fmtBrl(r.custo)) },
  { k: 'arca', t: 'Quem arca', sort: (r) => r.arca, texto: (r) => (r.arca ? ARCA_LBL[r.arca] : NV) },
  { k: 'status', t: 'Status', sort: (r) => r.status, texto: (r) => STATUS_LBL[r.status], tom: (r) => CORR_TOM[r.status] },
]

export const COLUNAS_MULTA: Coluna<MultaLinha>[] = [
  { k: 'data', t: 'Data da infração', sort: (r) => r.data, texto: (r) => dataBR(r.data) },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'motorista', t: 'Motorista', sort: (r) => r.motorista, texto: (r) => r.motorista ?? NV },
  { k: 'infracao', t: 'Infração', sort: (r) => r.infracao, texto: (r) => r.infracao ?? NV },
  { k: 'valor', t: 'Valor', r: true, sort: (r) => r.valor, texto: (r) => fmtBrl(r.valor) },
  { k: 'desc', t: 'Descontado', r: true, sort: (r) => r.desc, texto: (r) => (r.desc ? fmtBrl(r.desc) : NV) },
  {
    k: 'sit', t: 'Etapa', sort: (r) => ordemEtapa(r.sit), texto: (r) => MULTA_SIT_LBL[r.sit] ?? r.sit,
    tom: (r) => (r.sit === 'descontada' ? 'verde' : r.sit === 'contestada' ? 'cinza' : 'ambar'),
  },
  // a tela da base troca pela pill do prazo (MultasTable, celula 'prazo')
  { k: 'prazo', t: 'Prazo de indicação', sort: (r) => r.prazo, texto: (r) => (r.prazo ? dataBR(r.prazo) : NV) },
  { k: 'aut', t: 'Autorização', sort: (r) => r.aut, texto: (r) => AUT_LBL[r.aut] },
]

export const COLUNAS_SIN: Coluna<SinLinha>[] = [
  { k: 'data', t: 'Data', sort: (r) => r.data, texto: (r) => dataBR(r.data) },
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'motorista', t: 'Motorista', sort: (r) => r.motorista, texto: (r) => r.motorista ?? NV },
  { k: 'tipo', t: 'Tipo', sort: (r) => r.tipo, texto: (r) => SIN_TIPO_LBL[r.tipo] ?? r.tipo },
  { k: 'desc', t: 'Descrição', sort: (r) => r.desc, texto: (r) => r.desc },
  { k: 'dano', t: 'Valor do dano', r: true, sort: (r) => r.dano, texto: (r) => (r.dano == null ? NV : fmtBrl(r.dano)) },
  { k: 'descontado', t: 'Descontado', r: true, sort: (r) => r.descontado, texto: (r) => (r.descontado ? fmtBrl(r.descontado) : NV) },
  { k: 'sit', t: 'Situação', sort: (r) => r.sit, texto: (r) => SIN_SIT_LBL[r.sit], tom: (r) => (r.sit === 'encerrado' ? 'verde' : 'ambar') },
  // Não está nas colunas do mockup: mantém na lista as ações de autorização de hoje (decisão 3.4).
  { k: 'aut', t: 'Autorização', sort: (r) => r.aut, texto: (r) => AUT_LBL[r.aut] },
]

export function textoSituacaoDoc(r: DocLinha): string {
  if (r.sit === 'vencido') return `vencido há ${-r.dias} ${r.dias === -1 ? 'dia' : 'dias'}`
  if (r.sit === 'vence30') return `vence em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`
  return 'em dia'
}
export const COLUNAS_DOC: Coluna<DocLinha>[] = [
  { k: 'placa', t: 'Placa', sort: (r) => r.placa, texto: (r) => r.placa },
  { k: 'modelo', t: 'Modelo', sort: (r) => r.modelo, texto: (r) => r.modelo || NV },
  { k: 'tipo', t: 'Tipo', sort: (r) => r.tipo, texto: (r) => DOCUMENTO_TIPO_LABELS[r.tipo] ?? r.tipo },
  { k: 'numero', t: 'Número', sort: (r) => r.numero, texto: (r) => r.numero ?? NV },
  { k: 'venc', t: 'Vencimento', sort: (r) => r.venc, texto: (r) => dataBR(r.venc) },
  {
    k: 'sit', t: 'Situação', sort: (r) => r.venc, texto: textoSituacaoDoc,
    tom: (r) => (r.sit === 'vencido' ? 'vermelho' : r.sit === 'vence30' ? 'ambar' : 'verde'),
  },
]

export const COLUNAS: Record<BaseId, Coluna<never>[]> = {
  abast: COLUNAS_ABAST as Coluna<never>[],
  km: COLUNAS_KM as Coluna<never>[],
  mot: COLUNAS_MOT as Coluna<never>[],
  veic: COLUNAS_VEIC as Coluna<never>[],
  rev: COLUNAS_REV as Coluna<never>[],
  corr: COLUNAS_CORR as Coluna<never>[],
  multa: COLUNAS_MULTA as Coluna<never>[],
  sin: COLUNAS_SIN as Coluna<never>[],
  doc: COLUNAS_DOC as Coluna<never>[],
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
  const soma = <R,>(rs: R[], f: (r: R) => number | null) => rs.reduce((s, r) => s + (f(r) ?? 0), 0)
  if (base === 'rev') {
    const rs = rows as RevLinha[]
    return { resumo: plural(rs.length, 'revisão', 'revisões'), colunas: { valor: fmtBrl(soma(rs, (r) => r.valor)) } }
  }
  if (base === 'corr') {
    const rs = rows as CorrLinha[]
    return {
      resumo: plural(rs.length, 'manutenção', 'manutenções'),
      colunas: { dias: String(soma(rs, (r) => r.dias)), custo: fmtBrl(soma(rs, (r) => r.custo)) },
    }
  }
  if (base === 'multa') {
    const rs = rows as MultaLinha[]
    return { resumo: plural(rs.length, 'multa', 'multas'), colunas: { valor: fmtBrl(soma(rs, (r) => r.valor)), desc: fmtBrl(soma(rs, (r) => r.desc)) } }
  }
  if (base === 'sin') {
    const rs = rows as SinLinha[]
    return {
      resumo: plural(rs.length, 'sinistro', 'sinistros'),
      colunas: { dano: fmtBrl(soma(rs, (r) => r.dano)), descontado: fmtBrl(soma(rs, (r) => r.descontado)) },
    }
  }
  if (base === 'doc') return { resumo: plural(rows.length, 'documento', 'documentos'), colunas: {} }
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

// Bases de 03/11/2026: títulos = `BASES.*.planilha` do mockup. Dinheiro e KM como número, datas como
// data, autorização e sim/não em texto, nenhum caminho de arquivo.
const REV_SIT_EXCEL: Record<RevLinha['sit'], string> = {
  atrasada: 'atrasada', breve: 'vence em breve', dia: 'em dia', semprev: 'sem previsão automática', hist: 'histórico',
}
export const EXCEL_REV: ColunaExcel<RevLinha>[] = [
  { t: 'Data feita', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Modelo', largura: 16, v: (r) => r.modelo || null },
  { t: 'Tipo', largura: 12, v: (r) => tipoRev(r.tipo) },
  { t: 'Oficina', largura: 24, v: (r) => r.oficina },
  { t: 'KM feita', largura: 11, fmt: FMT_INT, v: (r) => r.km },
  { t: 'Valor', largura: 13, fmt: FMT_MOEDA, v: (r) => r.valor },
  { t: 'Peças trocadas', largura: 32, v: (r) => r.pecas },
  { t: 'Observações', largura: 30, v: (r) => r.obs },
  { t: 'Próxima (KM)', largura: 12, fmt: FMT_INT, v: (r) => r.proxKm },
  { t: 'Próxima (data)', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.proxData) },
  { t: 'Situação', largura: 18, v: (r) => REV_SIT_EXCEL[r.sit] },
  { t: 'Origem (manual / importada)', largura: 14, v: (r) => (r.origem === 'importacao' ? 'importada' : 'manual') },
]

export const EXCEL_CORR: ColunaExcel<CorrLinha>[] = [
  { t: 'Entrada', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Saída prevista', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.saidaPrev) },
  { t: 'Saída real', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.saida) },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Modelo', largura: 16, v: (r) => r.modelo || null },
  { t: 'Motorista', largura: 24, v: (r) => r.motorista },
  { t: 'Defeito', largura: 32, v: (r) => r.defeito },
  { t: 'Oficina', largura: 24, v: (r) => r.oficina },
  { t: 'Dias parado', largura: 10, fmt: FMT_INT, v: (r) => r.dias },
  { t: 'Custo', largura: 13, fmt: FMT_MOEDA, v: (r) => r.custo },
  { t: 'Quem arca', largura: 18, v: (r) => (r.arca ? ARCA_LBL[r.arca] : null) },
  { t: 'Status', largura: 20, v: (r) => STATUS_LBL[r.status] },
  { t: 'Carro saiu da equipe (sim/não)', largura: 14, v: (r) => sn(r.tirou) },
  { t: 'Observações', largura: 30, v: (r) => r.obs },
]

export const EXCEL_MULTA: ColunaExcel<MultaLinha>[] = [
  { t: 'Data da infração', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Motorista', largura: 24, v: (r) => r.motorista },
  { t: 'Infração', largura: 32, v: (r) => r.infracao },
  { t: 'Valor', largura: 13, fmt: FMT_MOEDA, v: (r) => r.valor },
  { t: 'Valor descontado', largura: 13, fmt: FMT_MOEDA, v: (r) => r.desc },
  { t: 'Etapa', largura: 22, v: (r) => MULTA_SIT_LBL[r.sit] ?? r.sit },
  { t: 'Autorização', largura: 12, v: (r) => AUT_LBL[r.aut] },
  { t: 'Prazo de indicação', largura: 12, fmt: FMT_DATA, v: (r) => (r.prazo ? dataExcel(r.prazo) : null) },
]

const DESCONTO_TXT = { nenhum: 'Nenhum', parcial: 'Parcial', total: 'Total' } as const
export const EXCEL_SIN: ColunaExcel<SinLinha>[] = [
  { t: 'Data', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.data) },
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Motorista', largura: 24, v: (r) => r.motorista },
  { t: 'Tipo', largura: 12, v: (r) => SIN_TIPO_LBL[r.tipo] ?? r.tipo },
  { t: 'Descrição', largura: 32, v: (r) => r.desc },
  { t: 'Valor do dano', largura: 13, fmt: FMT_MOEDA, v: (r) => r.dano },
  { t: 'Valor descontado', largura: 13, fmt: FMT_MOEDA, v: (r) => r.descontado },
  { t: 'Situação', largura: 14, v: (r) => SIN_SIT_LBL[r.sit] },
  { t: 'Desconto (tipo)', largura: 12, v: (r) => DESCONTO_TXT[r.tipoDesconto] ?? null },
]

export const EXCEL_DOC: ColunaExcel<DocLinha>[] = [
  { t: 'Placa', largura: 11, v: (r) => r.placa },
  { t: 'Modelo', largura: 16, v: (r) => r.modelo || null },
  { t: 'Tipo', largura: 20, v: (r) => DOCUMENTO_TIPO_LABELS[r.tipo] ?? r.tipo },
  { t: 'Número', largura: 18, v: (r) => r.numero },
  { t: 'Vencimento', largura: 12, fmt: FMT_DATA, v: (r) => dataExcel(r.venc) },
  { t: 'Situação', largura: 16, v: (r) => DOC_SIT_LBL[r.sit].toLowerCase() },
  { t: 'Dias para vencer', largura: 10, fmt: FMT_INT, v: (r) => r.dias },
]

export const EXCEL: Record<BaseId, { aba: string; arquivo: string; colunas: ColunaExcel<never>[] }> = {
  abast: { aba: 'Abastecimentos', arquivo: 'abastecimentos', colunas: EXCEL_ABAST as ColunaExcel<never>[] },
  km: { aba: 'KM diário', arquivo: 'km-diario', colunas: EXCEL_KM as ColunaExcel<never>[] },
  mot: { aba: 'Motoristas', arquivo: 'motoristas', colunas: EXCEL_MOT as ColunaExcel<never>[] },
  veic: { aba: 'Veículos', arquivo: 'veiculos', colunas: EXCEL_VEIC as ColunaExcel<never>[] },
  rev: { aba: 'Revisões', arquivo: 'revisoes', colunas: EXCEL_REV as ColunaExcel<never>[] },
  corr: { aba: 'Manutenção corretiva', arquivo: 'manutencao-corretiva', colunas: EXCEL_CORR as ColunaExcel<never>[] },
  multa: { aba: 'Multas', arquivo: 'multas', colunas: EXCEL_MULTA as ColunaExcel<never>[] },
  sin: { aba: 'Sinistros', arquivo: 'sinistros', colunas: EXCEL_SIN as ColunaExcel<never>[] },
  doc: { aba: 'Documentos', arquivo: 'documentos', colunas: EXCEL_DOC as ColunaExcel<never>[] },
}

export function linhasParaExcel(base: BaseId, rows: Linha[]): Celula[][] {
  const cols = EXCEL[base].colunas as unknown as ColunaExcel<Linha>[]
  return rows.map((r) => cols.map((c) => c.v(r)))
}

/** `frotas-<base>-AAAA-MM-DD.xlsx` */
export function nomeArquivoExcel(base: BaseId, hoje: string): string {
  return `frotas-${EXCEL[base].arquivo}-${hoje}.xlsx`
}
