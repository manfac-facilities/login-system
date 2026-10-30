/**
 * Monta as linhas das bases a partir das leituras cruas (puro, sem banco).
 */
import { contextosCorrecaoAbastecimento, contextosCorrecaoKm, valorOriginalKm, type CorrecaoAudit } from '../correcoes'
import { resolverNaData, type TrechoBruto } from './responsabilidade'
import type {
  AbastLinha, ClasseCnhBase, KmLinha, MotLinha, SituacaoVeiculo, VeicLinha,
} from './tipos'

export interface EquipeBruta { id: string; codigo: string }
export interface MotoristaBruto {
  id: string; nome: string; cnh: string | null; cnh_vencimento: string | null
  contato: string | null; equipe_id: string | null; ativo: boolean
}
export interface VeiculoBruto {
  id: string; placa: string; modelo: string; ano: number | null; km_atual: number
  km_contratual_mensal: number | null; valor_locacao_mensal: number | null
  status: 'ativo' | 'inativo' | 'manutencao'; equipe_id: string | null
  previsao_retorno_oficina: string | null; substituto_id: string | null
}
export interface AbastBruto {
  id: string; veiculo_id: string; data: string; litros: number | null
  valor: number; km: number | null; posto: string | null; created_at: string
}
export interface KmBruto {
  id: string; veiculo_id: string; equipe_id: string; motorista_id: string | null
  data: string; km_atual: number; observacoes: string | null; created_at: string
}

export interface EntradaMontagem {
  hoje: string
  equipes: EquipeBruta[]
  motoristas: MotoristaBruto[]
  veiculos: VeiculoBruto[]
  responsabilidade: TrechoBruto[]
  abastecimentos: AbastBruto[]
  km: KmBruto[]
  /** ids de abastecimento com correção no audit_log */
  corrigidosAbast: Set<string>
  correcoesKm: CorrecaoAudit[]
  /** só gestor precisa dos contextos de correção */
  comContexto: boolean
}

const DIA = 86400000
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) -
    Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / DIA)

export function classeCnh(venc: string | null, hoje: string): { classe: ClasseCnhBase; dias: number | null } {
  if (!venc) return { classe: 'sem', dias: null }
  const dias = diasEntre(hoje, venc.slice(0, 10))
  return { classe: dias < 0 ? 'vencida' : dias <= 60 ? 'vencendo' : 'em_dia', dias }
}

const porDataDesc = (a: { data: string; created_at: string }, b: { data: string; created_at: string }) =>
  b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at)

export function montarAbastecimentos(e: EntradaMontagem): AbastLinha[] {
  const cod = new Map(e.equipes.map((x) => [x.id, x.codigo]))
  const nome = new Map(e.motoristas.map((x) => [x.id, x.nome]))
  const vei = new Map(e.veiculos.map((x) => [x.id, x]))
  const ctx = e.comContexto ? contextosCorrecaoAbastecimento(e.abastecimentos) : null
  return [...e.abastecimentos].sort(porDataDesc).map((a) => {
    const r = resolverNaData(e.responsabilidade, a.veiculo_id, a.data)
    const litros = a.litros == null ? null : Number(a.litros)
    const valor = Number(a.valor)
    return {
      id: a.id,
      data: a.data,
      placa: vei.get(a.veiculo_id)?.placa ?? '—',
      modelo: vei.get(a.veiculo_id)?.modelo ?? '',
      equipe: r?.equipe_id ? cod.get(r.equipe_id) ?? null : null,
      motorista: r?.motorista_id ? nome.get(r.motorista_id) ?? null : null,
      litros,
      valor,
      preco: litros && litros > 0 ? valor / litros : null,
      km: a.km == null ? null : Number(a.km),
      posto: a.posto,
      criado: a.created_at,
      corrigido: e.corrigidosAbast.has(a.id),
      contexto: ctx?.get(a.id) ?? null,
    }
  })
}

/** Rodou desde o lançamento anterior do mesmo carro (null no primeiro). */
export function rodadoPorLancamento(km: KmBruto[]): Map<string, number | null> {
  const out = new Map<string, number | null>()
  const por = new Map<string, KmBruto[]>()
  for (const k of km) por.set(k.veiculo_id, [...(por.get(k.veiculo_id) ?? []), k])
  for (const lista of por.values()) {
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at))
    lista.forEach((k, i) => out.set(k.id, i === 0 ? null : Number(k.km_atual) - Number(lista[i - 1].km_atual)))
  }
  return out
}

export function montarKm(e: EntradaMontagem): KmLinha[] {
  const cod = new Map(e.equipes.map((x) => [x.id, x.codigo]))
  const nome = new Map(e.motoristas.map((x) => [x.id, x.nome]))
  const vei = new Map(e.veiculos.map((x) => [x.id, x]))
  const rodado = rodadoPorLancamento(e.km)
  const ctx = e.comContexto ? contextosCorrecaoKm(e.km) : null
  return [...e.km].sort(porDataDesc).map((k) => ({
    id: k.id,
    data: k.data,
    equipe: cod.get(k.equipe_id) ?? null,
    placa: vei.get(k.veiculo_id)?.placa ?? '—',
    motorista: k.motorista_id ? nome.get(k.motorista_id) ?? null : null,
    km: Number(k.km_atual),
    rodado: rodado.get(k.id) ?? null,
    obs: k.observacoes,
    criado: k.created_at,
    era: valorOriginalKm(e.correcoesKm, k.id, Number(k.km_atual)),
    veiculoKmAtual: vei.get(k.veiculo_id)?.km_atual ?? null,
    contexto: ctx?.get(k.id) ?? null,
  }))
}

export function montarMotoristas(e: EntradaMontagem): MotLinha[] {
  const cod = new Map(e.equipes.map((x) => [x.id, x.codigo]))
  return [...e.motoristas]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((m) => {
      const { classe, dias } = classeCnh(m.cnh_vencimento, e.hoje)
      return {
        id: m.id,
        nome: m.nome,
        equipe: m.equipe_id ? cod.get(m.equipe_id) ?? null : null,
        cnh: m.cnh,
        cnhVenc: m.cnh_vencimento ? m.cnh_vencimento.slice(0, 10) : null,
        cnhClasse: classe,
        cnhDias: dias,
        contato: m.contato,
        ativo: m.ativo,
      }
    })
}

export function montarVeiculos(e: EntradaMontagem): VeicLinha[] {
  const cod = new Map(e.equipes.map((x) => [x.id, x.codigo]))
  const nome = new Map(e.motoristas.map((x) => [x.id, x.nome]))
  const placa = new Map(e.veiculos.map((x) => [x.id, x.placa]))
  const rodado = rodadoPorLancamento(e.km)
  const mes = e.hoje.slice(0, 7)
  return [...e.veiculos]
    .sort((a, b) => a.placa.localeCompare(b.placa))
    .map((v) => {
      const trechos = e.responsabilidade
        .filter((t) => t.veiculo_id === v.id)
        .sort((a, b) => b.inicio.localeCompare(a.inicio) || b.created_at.localeCompare(a.created_at))
      const aberto = trechos.find((t) => t.fim === null) ?? null
      const equipeId = aberto ? aberto.equipe_id : v.equipe_id
      const sit: SituacaoVeiculo =
        v.status === 'inativo' ? 'fora' : v.status === 'manutencao' ? 'oficina' : aberto || v.equipe_id ? 'uso' : 'livre'
      const meusKm = e.km.filter((k) => k.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
      const doMes = meusKm.filter((k) => k.data.startsWith(mes))
      const meusAb = e.abastecimentos.filter((a) => a.veiculo_id === v.id).sort(porDataDesc)
      return {
        id: v.id,
        placa: v.placa,
        modelo: v.modelo,
        ano: v.ano,
        sit,
        equipe: equipeId ? cod.get(equipeId) ?? null : null,
        motorista: aberto?.motorista_id ? nome.get(aberto.motorista_id) ?? null : null,
        km: Number(v.km_atual),
        kmMes: doMes.length ? doMes.reduce((s, k) => s + (rodado.get(k.id) ?? 0), 0) : null,
        franquia: v.km_contratual_mensal,
        locacao: v.valor_locacao_mensal == null ? null : Number(v.valor_locacao_mensal),
        retorno: v.previsao_retorno_oficina ? v.previsao_retorno_oficina.slice(0, 10) : null,
        substituto: v.substituto_id ? placa.get(v.substituto_id) ?? null : null,
        historico: trechos.map((t) => ({
          inicio: t.inicio,
          fim: t.fim,
          equipe: t.equipe_id ? cod.get(t.equipe_id) ?? null : null,
          motorista: t.motorista_id ? nome.get(t.motorista_id) ?? null : null,
        })),
        ultimosKm: meusKm.slice(0, 5).map((k) => ({ data: k.data, km: Number(k.km_atual) })),
        ultimosAbast: meusAb.slice(0, 5).map((a) => ({ data: a.data, litros: a.litros == null ? null : Number(a.litros), valor: Number(a.valor) })),
      }
    })
}
