/**
 * Monta as linhas das 5 bases da terceira bateria (Revisões, Manutenção corretiva, Multas,
 * Sinistros, Documentos) a partir das leituras cruas. Puro, sem banco.
 * Nenhuma linha leva caminho de arquivo: só `temArquivo`.
 */
import { diasParados, type ManutencaoStatus, type QuemArca } from '../manutencoes'
import { classificarFrota, intervaloDoVeiculo, proximaEfetiva, type RevisaoPrev } from '../revisaoPrevisao'
import type { AutorizacaoStatus, DocumentoVeiculoTipo, MultaStatus, SinistroStatus, SinistroTipo, TipoDesconto } from '../types'
import type { MotoristaBruto, VeiculoBruto } from './montar'
import { resolverNaData, type TrechoBruto } from './responsabilidade'
import type { CorrLinha, DocLinha, MultaLinha, RevLinha, SinLinha, SituacaoDoc } from './tipos'
import type { MultaEtapa } from '../multaEtapas'

export interface RevBruta extends RevisaoPrev {
  motorista_id: string | null
  fornecedor: string | null
  valor: number | null
  origem: 'manual' | 'importacao'
  observacoes: string | null
  pecas_trocadas: string | null
}
export interface KmRecente { veiculo_id: string; data: string; km_atual: number }

export interface CorrBruta {
  id: string; veiculo_id: string; defeito: string; oficina: string | null
  data_entrada: string; saida_prevista: string | null; data_saida: string | null
  custo: number | null; quem_arca: QuemArca | null; status: ManutencaoStatus; tirou_da_equipe: boolean
  anexo_storage_path: string | null; observacoes: string | null; created_at: string
}
export interface MultaBruta {
  id: string; veiculo_id: string | null; motorista_id: string | null; data: string
  tipo_infracao: string | null; descricao: string | null; valor: number; valor_descontado: number | null
  status: MultaStatus; autorizacao_status: AutorizacaoStatus | null; autorizacao_solicitado_em: string | null; created_at: string
  etapa: MultaEtapa; prazo_indicacao: string | null
}
export interface SinBruto {
  id: string; veiculo_id: string | null; motorista_id: string | null; data: string; tipo: SinistroTipo
  descricao: string; valor_dano: number | null; valor_descontado: number | null; tipo_desconto: TipoDesconto
  status: SinistroStatus; autorizacao_status: AutorizacaoStatus | null; autorizacao_solicitado_em: string | null; created_at: string
}
export interface DocBruto {
  id: string; veiculo_id: string; tipo: DocumentoVeiculoTipo; numero: string | null; vencimento: string
  storage_path: string | null
}

const num = (v: number | string | null | undefined): number | null => (v == null ? null : Number(v))
const d10 = (v: string | null | undefined): string | null => (v ? v.slice(0, 10) : null)
const DIA = 86400000
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))

function mapas(veiculos: VeiculoBruto[], motoristas: MotoristaBruto[]) {
  return { vei: new Map(veiculos.map((v) => [v.id, v])), nome: new Map(motoristas.map((m) => [m.id, m.nome])) }
}

const desc = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1)

export function montarRevisoes(e: {
  hoje: string
  veiculos: VeiculoBruto[]
  motoristas: MotoristaBruto[]
  revisoes: RevBruta[]
  kmRecentes: KmRecente[]
}): RevLinha[] {
  const { vei, nome } = mapas(e.veiculos, e.motoristas)
  const frota = classificarFrota(
    e.veiculos.map((v) => ({ ...v, intervalo_revisao_km: v.intervalo_revisao_km ?? null })),
    e.revisoes,
    e.kmRecentes,
    e.hoje
  )
  const vigentes = new Map(frota.filter((x) => x.vigente).map((x) => [x.vigente!.id, x.s]))
  return [...e.revisoes]
    .sort((a, b) => desc(d10(a.data_realizada), d10(b.data_realizada)) || desc(a.created_at, b.created_at))
    .map((r) => {
      const v = vei.get(r.veiculo_id)
      const intervalo = intervaloDoVeiculo(v ?? {})
      const prox = proximaEfetiva(r, intervalo)
      const s = vigentes.get(r.id)
      return {
        id: r.id,
        veiculoId: r.veiculo_id,
        data: d10(r.data_realizada),
        placa: v?.placa ?? '—',
        modelo: v?.modelo ?? '',
        motorista: r.motorista_id ? nome.get(r.motorista_id) ?? null : null,
        tipo: r.tipo,
        oficina: r.fornecedor,
        km: num(r.km_realizada),
        valor: num(r.valor),
        pecas: r.pecas_trocadas,
        obs: r.observacoes,
        proxKm: prox.km,
        proxAuto: prox.auto,
        proxData: r.prever_proxima ? d10(r.proxima_data) : null,
        intervalo,
        sit: s && s !== 'sembase' ? s : 'hist',
        origem: r.origem === 'importacao' ? 'importacao' : 'manual',
      }
    })
}

export function montarCorretivas(e: {
  hoje: string
  veiculos: VeiculoBruto[]
  motoristas: MotoristaBruto[]
  responsabilidade: TrechoBruto[]
  manutencoes: CorrBruta[]
}): CorrLinha[] {
  const { vei, nome } = mapas(e.veiculos, e.motoristas)
  return [...e.manutencoes]
    .sort((a, b) => b.data_entrada.localeCompare(a.data_entrada) || b.created_at.localeCompare(a.created_at))
    .map((m) => {
      const v = vei.get(m.veiculo_id)
      const entrada = m.data_entrada.slice(0, 10)
      const saida = d10(m.data_saida)
      const t = resolverNaData(e.responsabilidade, m.veiculo_id, entrada)
      return {
        id: m.id,
        veiculoId: m.veiculo_id,
        data: entrada,
        saidaPrev: d10(m.saida_prevista),
        saida,
        placa: v?.placa ?? '—',
        modelo: v?.modelo ?? '',
        motorista: t?.motorista_id ? nome.get(t.motorista_id) ?? null : null,
        defeito: m.defeito,
        oficina: m.oficina,
        dias: m.tirou_da_equipe ? diasParados({ data_entrada: entrada, data_saida: saida }, e.hoje) : null,
        custo: num(m.custo),
        arca: m.quem_arca,
        status: m.status,
        tirou: m.tirou_da_equipe,
        obs: m.observacoes,
        temArquivo: !!m.anexo_storage_path,
      }
    })
}

export function montarMultas(e: { veiculos: VeiculoBruto[]; motoristas: MotoristaBruto[]; multas: MultaBruta[] }): MultaLinha[] {
  const { vei, nome } = mapas(e.veiculos, e.motoristas)
  return [...e.multas]
    .sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
    .map((m) => ({
      id: m.id,
      data: m.data.slice(0, 10),
      placa: (m.veiculo_id && vei.get(m.veiculo_id)?.placa) || '—',
      motorista: m.motorista_id ? nome.get(m.motorista_id) ?? null : null,
      infracao: m.tipo_infracao ?? m.descricao,
      valor: Number(m.valor),
      desc: num(m.valor_descontado),
      sit: m.etapa,
      prazo: d10(m.prazo_indicacao),
      aut: m.autorizacao_status ?? 'sem_solicitacao',
      autSolicitadoEm: m.autorizacao_solicitado_em,
    }))
}

export function montarSinistros(e: { veiculos: VeiculoBruto[]; motoristas: MotoristaBruto[]; sinistros: SinBruto[] }): SinLinha[] {
  const { vei, nome } = mapas(e.veiculos, e.motoristas)
  return [...e.sinistros]
    .sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
    .map((s) => ({
      id: s.id,
      data: s.data.slice(0, 10),
      placa: (s.veiculo_id && vei.get(s.veiculo_id)?.placa) || '—',
      motorista: s.motorista_id ? nome.get(s.motorista_id) ?? null : null,
      tipo: s.tipo,
      desc: s.descricao,
      dano: num(s.valor_dano),
      descontado: num(s.valor_descontado),
      tipoDesconto: s.tipo_desconto,
      sit: s.status,
      aut: s.autorizacao_status ?? 'sem_solicitacao',
      autSolicitadoEm: s.autorizacao_solicitado_em,
    }))
}

export function situacaoDocumento(venc: string, hoje: string): { sit: SituacaoDoc; dias: number } {
  const dias = Math.round((utc(venc) - utc(hoje)) / DIA)
  return { sit: dias < 0 ? 'vencido' : dias <= 30 ? 'vence30' : 'dia', dias }
}

export function montarDocumentos(e: { hoje: string; veiculos: VeiculoBruto[]; documentos: DocBruto[] }): DocLinha[] {
  const vei = new Map(e.veiculos.map((v) => [v.id, v]))
  return [...e.documentos]
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((d) => {
      const v = vei.get(d.veiculo_id)
      const venc = d.vencimento.slice(0, 10)
      return {
        id: d.id,
        placa: v?.placa ?? '—',
        modelo: v?.modelo ?? '',
        tipo: d.tipo,
        numero: d.numero,
        venc,
        ...situacaoDocumento(venc, e.hoje),
        temArquivo: !!d.storage_path,
      }
    })
}
