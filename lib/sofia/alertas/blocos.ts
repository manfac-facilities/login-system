/**
 * Blocos do e-mail diário de alertas da Gestão de Frotas — funções puras.
 * Spec: docs/superpowers/specs/2026-10-30-frotas-segunda-bateria-design.md (decisões 5, 6, 7).
 * Mockup: docs/frotas/mockups/2026-10-30-mockup-segunda-bateria.html (seção 3).
 *
 * Reaproveita `classificarRevisao` (mesma conta da tela de Revisões) sem alterá-la.
 */
import { DOCUMENTO_TIPO_LABELS } from '../enums'
import { classificarRevisao, formatarDataIso, formatarKm } from '../revisaoStatus'
import type { DocumentoVeiculoTipo, VeiculoStatus } from '../types'

export const DIAS_DOCUMENTO = 30
// Mockup (bloco "CNH vencida ou vencendo em 60 dias") e `getMotoristasComCnhVencendo` usam 60.
export const DIAS_CNH = 60

export interface EntradaAlertas {
  /** AAAA-MM-DD, em horário de Brasília. */
  hoje: string
  veiculos: {
    id: string
    placa: string
    km_atual: number
    status: VeiculoStatus
    equipe_id: string | null
    previsao_retorno_oficina: string | null
  }[]
  equipes: { id: string; codigo: string; ativo: boolean }[]
  motoristas: { nome: string; cnh_vencimento: string | null; equipe_id: string | null; ativo: boolean }[]
  revisoes: {
    veiculo_id: string
    tipo: string
    proxima_data: string | null
    proxima_km: number | null
    created_at: string
  }[]
  documentos: { veiculo_id: string; tipo: DocumentoVeiculoTipo; vencimento: string }[]
  multas: { veiculo_id: string | null; motorista_nome: string | null; data: string; valor: number; status: string }[]
  sinistros: { veiculo_id: string | null; data: string; tipo: string; status: string }[]
  /** Equipes que lançaram KM no dia útil anterior. */
  equipesComKmNoDiaUtilAnterior: string[]
}

export type ChaveBloco =
  | 'revisoes_atrasadas'
  | 'revisoes_chegando'
  | 'equipes_sem_km'
  | 'documentos'
  | 'cnh'
  | 'multas'
  | 'sinistros'
  | 'oficina'

export interface ItemAlerta {
  rotulo: string
  detalhe: string
  /** Já venceu: o e-mail destaca em laranja. */
  vencido: boolean
  /** Caminho no hub, sem domínio. */
  caminho: string
}

export interface BlocoAlerta {
  chave: ChaveBloco
  titulo: string
  itens: ItemAlerta[]
}

export interface Alertas {
  hoje: string
  diaUtilAnterior: string
  blocos: BlocoAlerta[]
  total: number
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const SEMANA_LONGA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

const utc = (d: string) => new Date(`${d}T00:00:00Z`)

export function somarDias(data: string, n: number): string {
  const d = utc(data)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate).getTime() - utc(de).getTime()) / 86_400_000)
}

/** Último dia útil (seg–sex) antes de `hoje`. Feriados não são considerados. */
export function diaUtilAnterior(hoje: string): string {
  let d = somarDias(hoje, -1)
  while ([0, 6].includes(utc(d).getUTCDay())) d = somarDias(d, -1)
  return d
}

/** "sex 30/10" */
export function diaCurto(data: string): string {
  return `${SEMANA[utc(data).getUTCDay()]} ${data.slice(8, 10)}/${data.slice(5, 7)}`
}

/** "sexta-feira, 30/10/2026" */
export function diaLongo(data: string): string {
  return `${SEMANA_LONGA[utc(data).getUTCDay()]}, ${formatarDataIso(data)}`
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Ordenavel = ItemAlerta & { ordem: string }
const ordenar = (xs: Ordenavel[]): ItemAlerta[] =>
  [...xs]
    .sort((a, b) => a.ordem.localeCompare(b.ordem))
    .map(({ rotulo, detalhe, vencido, caminho }) => ({ rotulo, detalhe, vencido, caminho }))

export function montarAlertas(e: EntradaAlertas): Alertas {
  const { hoje } = e
  const anterior = diaUtilAnterior(hoje)
  const veiculo = new Map(e.veiculos.map((v) => [v.id, v]))
  const equipe = new Map(e.equipes.map((q) => [q.id, q.codigo]))
  const placa = (id: string | null) => (id ? veiculo.get(id)?.placa : undefined) ?? 'sem placa'
  const eqDoVeiculo = (id: string | null) => {
    const q = id ? veiculo.get(id)?.equipe_id : null
    return (q && equipe.get(q)) || 'sem equipe'
  }

  // Revisões: só a mais recente de cada veículo+tipo conta (mesma regra de queries.ts).
  const maisRecente = new Map<string, EntradaAlertas['revisoes'][number]>()
  for (const r of [...e.revisoes].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = `${r.veiculo_id}::${r.tipo}`
    if (!maisRecente.has(k)) maisRecente.set(k, r)
  }
  const atrasadas: Ordenavel[] = []
  const chegando: Ordenavel[] = []
  for (const r of maisRecente.values()) {
    const c = classificarRevisao(r, veiculo.get(r.veiculo_id)?.km_atual, hoje)
    const base = { rotulo: placa(r.veiculo_id), caminho: '/sofia/revisoes', ordem: r.proxima_data ?? '9999' }
    if (c.situacao === 'atrasada') {
      const partes: string[] = []
      if (c.motivos.includes('km')) partes.push(`por KM: passou ${formatarKm(c.kmPassados ?? 0)} km do previsto`)
      if (c.motivos.includes('data') && r.proxima_data) {
        partes.push(`por data: prevista para ${formatarDataIso(r.proxima_data)} (${plural(diasEntre(r.proxima_data, hoje), 'dia', 'dias')} de atraso)`)
      }
      atrasadas.push({ ...base, vencido: true, detalhe: `(${eqDoVeiculo(r.veiculo_id)}) — ${partes.join('; ')}` })
    } else if (c.situacao === 'vence_em_breve') {
      chegando.push({ ...base, vencido: false, detalhe: `(${eqDoVeiculo(r.veiculo_id)}) — faltam ${formatarKm(c.kmRestantes ?? 0)} km` })
    }
  }

  // Equipes ativas com carro e sem KM no dia útil anterior (decisão 6).
  const lancou = new Set(e.equipesComKmNoDiaUtilAnterior)
  const semKm: ItemAlerta[] = []
  for (const q of [...e.equipes].filter((x) => x.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    if (lancou.has(q.id)) continue
    const carro = e.veiculos.find((v) => v.equipe_id === q.id && v.status !== 'inativo')
    if (!carro) continue
    const mot = e.motoristas.find((m) => m.equipe_id === q.id && m.ativo)
    semKm.push({ rotulo: q.codigo, detalhe: `— ${carro.placa}${mot ? `, ${mot.nome}` : ''}`, vencido: false, caminho: '/sofia/km' })
  }

  const limiteDoc = somarDias(hoje, DIAS_DOCUMENTO)
  const docs: Ordenavel[] = e.documentos
    .filter((d) => d.vencimento <= limiteDoc)
    .map((d) => {
      const vencido = d.vencimento < hoje
      const quando = vencido
        ? `venceu em ${formatarDataIso(d.vencimento)}`
        : `vence em ${formatarDataIso(d.vencimento)} (${plural(diasEntre(hoje, d.vencimento), 'dia', 'dias')})`
      return {
        rotulo: placa(d.veiculo_id),
        detalhe: `— ${DOCUMENTO_TIPO_LABELS[d.tipo] ?? d.tipo}: ${quando}`,
        vencido,
        caminho: '/sofia/documentos',
        ordem: d.vencimento,
      }
    })

  const limiteCnh = somarDias(hoje, DIAS_CNH)
  const cnh: Ordenavel[] = e.motoristas
    .filter((m) => m.ativo && m.cnh_vencimento && m.cnh_vencimento <= limiteCnh)
    .map((m) => {
      const venc = m.cnh_vencimento as string
      const vencido = venc < hoje
      return {
        rotulo: m.nome,
        detalhe: `(${(m.equipe_id && equipe.get(m.equipe_id)) || 'sem equipe'}) — ${vencido ? 'venceu' : 'vence'} em ${formatarDataIso(venc)}`,
        vencido,
        caminho: '/sofia/motoristas',
        ordem: venc,
      }
    })

  const multas: Ordenavel[] = e.multas
    .filter((m) => m.status !== 'descontada')
    .map((m) => ({
      rotulo: placa(m.veiculo_id),
      detalhe: `— ${m.motorista_nome ?? 'sem motorista'}, ${formatarDataIso(m.data)}, ${brl(m.valor)} · ${m.status}`,
      vencido: false,
      caminho: '/sofia/multas',
      ordem: m.data,
    }))

  const sinistros: Ordenavel[] = e.sinistros
    .filter((s) => s.status !== 'encerrado')
    .map((s) => ({
      rotulo: placa(s.veiculo_id),
      detalhe: `(${eqDoVeiculo(s.veiculo_id)}) — ${s.tipo} em ${formatarDataIso(s.data)}, ${s.status.replace('_', ' ')}`,
      vencido: false,
      caminho: '/sofia/sinistros',
      ordem: s.data,
    }))

  const oficina: Ordenavel[] = e.veiculos
    .filter((v) => v.status === 'manutencao' && v.previsao_retorno_oficina && v.previsao_retorno_oficina < hoje)
    .map((v) => {
      const prev = v.previsao_retorno_oficina as string
      return {
        rotulo: v.placa,
        detalhe: `— previsão era ${formatarDataIso(prev)} (${plural(diasEntre(prev, hoje), 'dia', 'dias')})`,
        vencido: true,
        caminho: '/sofia/veiculos',
        ordem: prev,
      }
    })

  const todos: BlocoAlerta[] = [
    { chave: 'revisoes_atrasadas', titulo: 'Revisões atrasadas', itens: ordenar(atrasadas) },
    { chave: 'revisoes_chegando', titulo: 'Revisões chegando (faltam até 1.000 km)', itens: ordenar(chegando) },
    { chave: 'equipes_sem_km', titulo: `Equipes sem KM diário de ontem (${diaCurto(anterior)})`, itens: semKm },
    { chave: 'documentos', titulo: `Documentos vencidos ou vencendo em ${DIAS_DOCUMENTO} dias`, itens: ordenar(docs) },
    { chave: 'cnh', titulo: `CNH vencida ou vencendo em ${DIAS_CNH} dias`, itens: ordenar(cnh) },
    { chave: 'multas', titulo: 'Multas sem tratativa', itens: ordenar(multas) },
    { chave: 'sinistros', titulo: 'Sinistros abertos', itens: ordenar(sinistros) },
    { chave: 'oficina', titulo: 'Volta da oficina atrasada', itens: ordenar(oficina) },
  ]
  const blocos = todos.filter((b) => b.itens.length > 0)
  return { hoje, diaUtilAnterior: anterior, blocos, total: blocos.reduce((n, b) => n + b.itens.length, 0) }
}

export const contar = (a: Alertas, chave: ChaveBloco) => a.blocos.find((b) => b.chave === chave)?.itens.length ?? 0
export const contarDocumentosVencidos = (a: Alertas) =>
  a.blocos.find((b) => b.chave === 'documentos')?.itens.filter((i) => i.vencido).length ?? 0
