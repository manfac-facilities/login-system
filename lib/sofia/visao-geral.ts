/**
 * Funções puras da visão geral do Frotas (spec 30/10/2026, decisões 2, 3, 4, 6, 7, 9).
 * Sem acesso a banco: as leituras ficam em visao-geral-leituras.ts.
 */

type Num = number | string | null | undefined
const n = (x: Num) => Number(x ?? 0)
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// ---------- 1.1 frota agora ----------

export interface FrotaPorSituacao {
  uso: number
  livre: number
  oficina: number
  fora: number
  /** todos menos inativos */
  base: number
  /** ativos fora da oficina (em uso + livre) */
  disponiveis: number
  disponibilidadePct: number
}

/** Em uso = ativo com equipe no cadastro (`veiculos.equipe_id`); Livre = ativo sem; Na oficina = status manutencao; Fora = inativo. */
export function frotaPorSituacao(
  veiculos: { id: string; status: 'ativo' | 'inativo' | 'manutencao' }[],
  responsabilidadesAtuais: { veiculo_id: string }[]
): FrotaPorSituacao {
  const comResp = new Set(responsabilidadesAtuais.map((r) => r.veiculo_id))
  let uso = 0
  let livre = 0
  let oficina = 0
  let fora = 0
  for (const v of veiculos) {
    if (v.status === 'inativo') fora++
    else if (v.status === 'manutencao') oficina++
    else if (comResp.has(v.id)) uso++
    else livre++
  }
  const base = uso + livre + oficina
  const disponiveis = uso + livre
  return { uso, livre, oficina, fora, base, disponiveis, disponibilidadePct: base ? Math.round((disponiveis / base) * 100) : 0 }
}

// ---------- 1.2 ações de hoje ----------

/** Dia útil anterior a `hoje` (AAAA-MM-DD). Sábado/domingo: null (fim de semana não cobra). */
export function diaUtilCobrado(hoje: string): string | null {
  const d = new Date(`${hoje}T12:00:00Z`)
  const dow = d.getUTCDay()
  if (dow === 0 || dow === 6) return null
  d.setUTCDate(d.getUTCDate() - (dow === 1 ? 3 : 1))
  return d.toISOString().slice(0, 10)
}

/** Equipe ativa com carro ativo (equipe no cadastro do veículo) e sem KM lançado no dia. */
export function equipesSemKm(p: {
  equipes: { id: string; codigo: string; ativo: boolean }[]
  responsabilidades: { veiculo_id: string; equipe_id: string | null }[]
  veiculos: { id: string; status: string }[]
  kmDoDia: { equipe_id: string }[]
}): { id: string; codigo: string }[] {
  const veicAtivos = new Set(p.veiculos.filter((v) => v.status === 'ativo').map((v) => v.id))
  const comCarro = new Set(
    p.responsabilidades.filter((r) => r.equipe_id && veicAtivos.has(r.veiculo_id)).map((r) => r.equipe_id as string)
  )
  const lancaram = new Set(p.kmDoDia.map((k) => k.equipe_id))
  return p.equipes
    .filter((e) => e.ativo && comCarro.has(e.id) && !lancaram.has(e.id))
    .map((e) => ({ id: e.id, codigo: e.codigo }))
}

export function classificarCnh<M extends { ativo: boolean; cnh_vencimento: string | null }>(
  motoristas: M[],
  hoje: string,
  dias = 60
): { vencidas: M[]; vencendo: M[] } {
  const lim = new Date(`${hoje}T12:00:00Z`)
  lim.setUTCDate(lim.getUTCDate() + dias)
  const limite = lim.toISOString().slice(0, 10)
  const ativos = motoristas.filter((m) => m.ativo && m.cnh_vencimento)
  return {
    vencidas: ativos.filter((m) => (m.cnh_vencimento as string) < hoje),
    vencendo: ativos.filter((m) => (m.cnh_vencimento as string) >= hoje && (m.cnh_vencimento as string) <= limite),
  }
}

export interface AcaoHoje {
  id: string
  n: number
  urgente: boolean
  titulo: string
  descricao: string
  href: string
  irPara: string
}

export interface EntradaAcoes {
  revisoesAtrasadas: { placa: string | null; motivo: 'km' | 'data' }[]
  revisoesBreve: { placa: string | null; km_restantes: number }[]
  equipesSemKm: { codigo: string }[]
  /** dia cobrado (AAAA-MM-DD) ou null em fim de semana */
  diaKm: string | null
  documentos: { placa: string | null; tipo: string; vencimento: string }[]
  cnhVencidas: { nome: string; cnh_vencimento: string | null }[]
  cnhVencendo: { nome: string; cnh_vencimento: string | null }[]
  multas: { status: string; valor: number | string }[]
  sinistros: { placa: string | null; status: string }[]
  veiculosOficinaAtrasados: string[]
}

const placaDe = (p: string | null) => p ?? 'sem placa'

export function montarAcoes(e: EntradaAcoes, hoje?: string): AcaoHoje[] {
  const out: AcaoHoje[] = []
  const add = (a: AcaoHoje) => a.n > 0 && out.push(a)

  const porKm = e.revisoesAtrasadas.filter((r) => r.motivo === 'km')
  const porData = e.revisoesAtrasadas.filter((r) => r.motivo !== 'km')
  add({
    id: 'revisoes-atrasadas', n: e.revisoesAtrasadas.length, urgente: true,
    titulo: 'Revisões atrasadas',
    descricao: `${porKm.length} por KM (${porKm.map((r) => placaDe(r.placa)).join(', ')}) · ${porData.length} por data (${porData.map((r) => placaDe(r.placa)).join(', ')})`,
    href: '/sofia/revisoes', irPara: 'Revisões',
  })
  add({
    id: 'revisoes-breve', n: e.revisoesBreve.length, urgente: false,
    titulo: 'Revisões chegando (faltam até 1.000 km)',
    descricao: e.revisoesBreve.map((r) => `${placaDe(r.placa)} faltam ${r.km_restantes.toLocaleString('pt-BR')} km`).join(' · '),
    href: '/sofia/revisoes', irPara: 'Revisões',
  })
  if (e.diaKm) {
    add({
      id: 'sem-km', n: e.equipesSemKm.length, urgente: true,
      titulo: `Equipes sem KM diário de ontem (${dm(e.diaKm)})`,
      descricao: e.equipesSemKm.map((x) => x.codigo).join(', '),
      href: `/sofia/km?de=${e.diaKm}&ate=${e.diaKm}`, irPara: 'KM diário',
    })
  }
  add({
    id: 'documentos', n: e.documentos.length, urgente: true,
    titulo: 'Documentos vencidos ou vencendo em 30 dias',
    descricao: e.documentos
      .map((d) => `${placaDe(d.placa)} ${d.tipo} ${hoje && d.vencimento < hoje ? 'venceu' : 'vence'} ${dm(d.vencimento)}`)
      .join(' · '),
    href: '/sofia/documentos', irPara: 'Documentos',
  })
  add({
    id: 'cnh', n: e.cnhVencidas.length + e.cnhVencendo.length, urgente: e.cnhVencidas.length > 0,
    titulo: 'CNH vencida ou vencendo em 60 dias',
    descricao: [
      ...e.cnhVencidas.map((m) => `${m.nome} venceu ${m.cnh_vencimento ? dm(m.cnh_vencimento) : ''}`.trim()),
      ...e.cnhVencendo.map((m) => `${m.nome} vence ${m.cnh_vencimento ? dm(m.cnh_vencimento) : ''}`.trim()),
    ].join(' · '),
    href: '/sofia/motoristas?cnh=alerta', irPara: 'Motoristas',
  })
  const pend = e.multas.filter((m) => m.status === 'pendente').length
  const valid = e.multas.filter((m) => m.status === 'validada').length
  const totalMultas = e.multas.reduce((s, m) => s + n(m.valor), 0)
  add({
    id: 'multas', n: e.multas.length, urgente: false,
    titulo: 'Multas sem tratativa',
    descricao: `${pend} pendente${pend === 1 ? '' : 's'}, ${valid} validada${valid === 1 ? '' : 's'} aguardando desconto · ${totalMultas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    href: '/sofia/multas', irPara: 'Multas',
  })
  add({
    id: 'sinistros', n: e.sinistros.length, urgente: false,
    titulo: 'Sinistros abertos',
    descricao: e.sinistros.map((x) => `${placaDe(x.placa)} ${x.status.replace('_', ' ')}`).join(' · '),
    href: '/sofia/sinistros', irPara: 'Sinistros',
  })
  add({
    id: 'oficina-atrasada', n: e.veiculosOficinaAtrasados.length, urgente: true,
    titulo: 'Volta da oficina atrasada', descricao: e.veiculosOficinaAtrasados.join(', '),
    href: '/sofia/veiculos?sit=oficina', irPara: 'Veículos',
  })
  return out
}

// ---------- 1.3 custos do mês (mesma regra da tela Custos) ----------

export interface CustosDoMes {
  itens: { locacao: number; abastecimento: number; revisoes: number; sinistros: number; multas: number }
  total: number
}

export function somarCustosDoMes(p: {
  veiculos: { valor_locacao_mensal: Num }[]
  multas: { valor: Num; valor_descontado: Num }[]
  sinistros: { valor_dano: Num; valor_descontado: Num }[]
  revisoes: { valor: Num }[]
  abastecimentos: { valor: Num }[]
}): CustosDoMes {
  const soma = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0)
  const itens = {
    locacao: soma(p.veiculos, (v) => n(v.valor_locacao_mensal)),
    abastecimento: soma(p.abastecimentos, (a) => n(a.valor)),
    revisoes: soma(p.revisoes, (r) => n(r.valor)),
    sinistros: soma(p.sinistros, (s) => n(s.valor_dano) - n(s.valor_descontado)),
    multas: soma(p.multas, (m) => n(m.valor) - n(m.valor_descontado)),
  }
  return { itens, total: Object.values(itens).reduce((a, b) => a + b, 0) }
}

// ---------- 1.3b extratos por centro de custo ----------

export interface LinhaCentroCusto {
  codigo: string | null
  nome: string
  ticketlogCentavos: number
  veloeCentavos: number
  totalCentavos: number
}

const cent = (v: Num) => Math.round(n(v) * 100)

export function agruparExtratosPorCentroCusto(
  gastos: { plataforma: string; valor: Num; centro_custo_codigo: string | null; centro_custo_nome: string | null }[]
): { linhas: LinhaCentroCusto[]; totalCentavos: number } {
  const mapa = new Map<string, LinhaCentroCusto>()
  for (const g of gastos) {
    const chave = g.centro_custo_codigo ?? '__sem'
    let l = mapa.get(chave)
    if (!l) {
      l = { codigo: g.centro_custo_codigo, nome: g.centro_custo_nome ?? 'Sem centro de custo', ticketlogCentavos: 0, veloeCentavos: 0, totalCentavos: 0 }
      mapa.set(chave, l)
    }
    const c = cent(g.valor)
    if (g.plataforma === 'ticketlog') l.ticketlogCentavos += c
    else if (g.plataforma === 'veloe') l.veloeCentavos += c
    else continue
    l.totalCentavos += c
  }
  const linhas = [...mapa.values()].sort((a, b) =>
    a.codigo === null ? 1 : b.codigo === null ? -1 : a.codigo.localeCompare(b.codigo)
  )
  return { linhas, totalCentavos: linhas.reduce((s, l) => s + l.totalCentavos, 0) }
}

// ---------- documentos: só o mais recente por veículo + tipo ----------

/** Documento antigo já renovado não conta: vale a linha de `created_at` mais recente de cada veículo+tipo. */
export function documentosAVencer<D extends { veiculo_id: string; tipo: string; vencimento: string; created_at: string }>(
  docs: D[],
  hoje: string,
  dias = 30
): D[] {
  const lim = new Date(`${hoje}T12:00:00Z`)
  lim.setUTCDate(lim.getUTCDate() + dias)
  const limite = lim.toISOString().slice(0, 10)
  const recente = new Map<string, D>()
  for (const d of docs) {
    const k = `${d.veiculo_id}::${d.tipo}`
    const a = recente.get(k)
    if (!a || d.created_at > a.created_at) recente.set(k, d)
  }
  return [...recente.values()].filter((d) => d.vencimento <= limite).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

// ---------- 1.1 carros na oficina agora ----------

export interface CarroNaOficina {
  placa: string
  modelo: string
  desde: string | null
  retorno: string | null
  diasAtraso: number
}

export function carrosNaOficina(
  veiculos: { id: string; placa: string; modelo: string; status: string; previsao_retorno_oficina: string | null }[],
  desdePorVeiculo: Map<string, string>,
  hoje: string
): CarroNaOficina[] {
  const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
  return veiculos
    .filter((v) => v.status === 'manutencao')
    .map((v) => {
      const r = v.previsao_retorno_oficina
      return {
        placa: v.placa,
        modelo: v.modelo,
        desde: desdePorVeiculo.get(v.id)?.slice(0, 10) ?? null,
        retorno: r,
        diasAtraso: r && r < hoje ? Math.round((dia(hoje) - dia(r)) / 86400000) : 0,
      }
    })
}
