/**
 * F2/F3 — funções puras da prévia de correção (KM diário e abastecimento) e da
 * formatação do "Histórico de correções". Espelham as regras das funções do
 * banco (sdd-sql-sofia-correcoes-f1-f3.sql); o SERVIDOR é a autoridade — isto
 * só serve para a tela mostrar o erro e as consequências antes de salvar.
 */

export interface Vizinho {
  data: string // 'AAAA-MM-DD'
  km: number
}

// ---------------------------------------------------------------- formatação

export const fmtKm = (n: number) => Math.round(n).toLocaleString('pt-BR')
export const fmtLitros = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fmtBrl = (n: number) =>
  'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** '2026-10-10' -> '10/10/2026' */
export const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
/** '2026-10-10' -> '10/10' */
export const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- KM diário

export interface LancamentoKm {
  id: string
  veiculo_id: string
  data: string
  km_atual: number
}

export interface ContextoKm {
  anterior: Vizinho | null
  seguinte: Vizinho | null
  /** maior KM dos OUTROS lançamentos do mesmo veículo (null = não há outros) */
  maxOutros: number | null
}

/**
 * Para cada lançamento: vizinho imediato anterior/seguinte do mesmo veículo
 * por data (unique (data, veiculo_id) garante um por dia) e o maior KM dos
 * outros lançamentos — é o que a função do banco usa para recalcular
 * veiculos.km_atual.
 */
export function contextosCorrecaoKm(lancamentos: LancamentoKm[]): Map<string, ContextoKm> {
  const porVeiculo = new Map<string, LancamentoKm[]>()
  for (const l of lancamentos) {
    const lista = porVeiculo.get(l.veiculo_id) ?? []
    lista.push(l)
    porVeiculo.set(l.veiculo_id, lista)
  }
  const out = new Map<string, ContextoKm>()
  for (const lista of porVeiculo.values()) {
    lista.sort((a, b) => a.data.localeCompare(b.data))
    // maior e segundo maior, para "max dos outros" em O(1) por linha
    let max1 = -Infinity
    let max2 = -Infinity
    let idMax1 = ''
    for (const l of lista) {
      if (l.km_atual > max1) {
        max2 = max1
        max1 = l.km_atual
        idMax1 = l.id
      } else if (l.km_atual > max2) {
        max2 = l.km_atual
      }
    }
    lista.forEach((l, i) => {
      const ant = lista[i - 1]
      const prox = lista[i + 1]
      const outros = l.id === idMax1 ? max2 : max1
      out.set(l.id, {
        anterior: ant ? { data: ant.data, km: ant.km_atual } : null,
        seguinte: prox ? { data: prox.data, km: prox.km_atual } : null,
        maxOutros: Number.isFinite(outros) ? outros : null,
      })
    })
  }
  return out
}

/** KM atual do veículo depois de corrigir este lançamento para `novo`. */
export function kmVeiculoDepois(ctx: ContextoKm, novo: number): number {
  return ctx.maxOutros == null ? novo : Math.max(ctx.maxOutros, novo)
}

/** null = pode salvar; string = mensagem (textos do mockup, seção 4). */
export function erroCorrecaoKm(ctx: ContextoKm, kmLancado: number, digitado: string): string | null {
  if (digitado.trim() === '') return 'Informe o KM correto.'
  const v = Number(digitado)
  if (Number.isNaN(v) || v < 0) return 'Informe o KM correto.'
  if (!Number.isInteger(v)) return 'O KM precisa ser um número inteiro, sem vírgula ou ponto.'
  if (ctx.anterior && v < ctx.anterior.km)
    return `O KM não pode ser menor que o lançamento anterior: ${fmtKm(ctx.anterior.km)} km em ${dataBR(ctx.anterior.data)}.`
  if (ctx.seguinte && v > ctx.seguinte.km)
    return `O KM não pode ser maior que o lançamento seguinte: ${fmtKm(ctx.seguinte.km)} km em ${dataBR(ctx.seguinte.data)}.`
  if (v === kmLancado) return 'O valor é igual ao lançado. Nada a corrigir.'
  return null
}

// ---------------------------------------------------------------- abastecimento

export interface LinhaAbastecimento {
  id: string
  veiculo_id: string
  data: string
  created_at: string
  litros: number | null
  valor: number
  km: number | null
}

export interface ContextoAbastecimento {
  /** abastecimento mais próximo do mesmo veículo QUE TEM km (pula os sem km) */
  anterior: Vizinho | null
  seguinte: Vizinho | null
  /** 'AAAA-MM' do abastecimento */
  mes: string
  /** soma do mesmo veículo no mesmo mês, incluindo este abastecimento */
  mesLitros: number
  mesValor: number
}

const ordemAbast = (a: LinhaAbastecimento, b: LinhaAbastecimento) =>
  a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)

/** Mesma ordem da função do banco: (data, created_at, id). */
export function contextosCorrecaoAbastecimento(
  linhas: LinhaAbastecimento[]
): Map<string, ContextoAbastecimento> {
  const porVeiculo = new Map<string, LinhaAbastecimento[]>()
  const somaMes = new Map<string, { l: number; v: number }>()
  for (const a of linhas) {
    const lista = porVeiculo.get(a.veiculo_id) ?? []
    lista.push(a)
    porVeiculo.set(a.veiculo_id, lista)
    const chave = `${a.veiculo_id}::${a.data.slice(0, 7)}`
    const s = somaMes.get(chave) ?? { l: 0, v: 0 }
    s.l += Number(a.litros ?? 0)
    s.v += Number(a.valor)
    somaMes.set(chave, s)
  }
  const out = new Map<string, ContextoAbastecimento>()
  for (const lista of porVeiculo.values()) {
    lista.sort(ordemAbast)
    lista.forEach((a, i) => {
      let anterior: Vizinho | null = null
      for (let j = i - 1; j >= 0; j--) {
        const k = lista[j].km
        if (k != null) { anterior = { data: lista[j].data, km: Number(k) }; break }
      }
      let seguinte: Vizinho | null = null
      for (let j = i + 1; j < lista.length; j++) {
        const k = lista[j].km
        if (k != null) { seguinte = { data: lista[j].data, km: Number(k) }; break }
      }
      const mes = a.data.slice(0, 7)
      const s = somaMes.get(`${a.veiculo_id}::${mes}`)!
      out.set(a.id, { anterior, seguinte, mes, mesLitros: s.l, mesValor: s.v })
    })
  }
  return out
}

export interface ValoresAbastecimento {
  litros: number
  valor: number
  km: number | null
}

/**
 * Lê os três campos digitados. Devolve o erro (textos do mockup) ou os valores.
 * KM só é comparado com os vizinhos quando muda (revisão B1).
 */
export function validarCorrecaoAbastecimento(
  ctx: ContextoAbastecimento,
  lancado: { litros: number | null; valor: number; km: number | null },
  digitado: { litros: string; valor: string; km: string }
): { erro: string } | { valores: ValoresAbastecimento } {
  const L = Number(digitado.litros)
  if (digitado.litros.trim() === '' || Number.isNaN(L) || L < 0) return { erro: 'Informe os litros abastecidos.' }
  const V = Number(digitado.valor)
  if (digitado.valor.trim() === '' || Number.isNaN(V) || V < 0) return { erro: 'Informe o valor do abastecimento.' }
  let K: number | null = null
  if (digitado.km.trim() !== '') {
    K = Number(digitado.km)
    if (Number.isNaN(K) || K < 0 || !Number.isInteger(K)) return { erro: 'KM inválido.' }
  }
  const kmLancado = lancado.km == null ? null : Number(lancado.km)
  if (K != null && K !== kmLancado) {
    if (ctx.anterior && K < ctx.anterior.km)
      return { erro: `O KM não pode ser menor que o do abastecimento anterior: ${fmtKm(ctx.anterior.km)} km em ${dataBR(ctx.anterior.data)}.` }
    if (ctx.seguinte && K > ctx.seguinte.km)
      return { erro: `O KM não pode ser maior que o do abastecimento seguinte: ${fmtKm(ctx.seguinte.km)} km em ${dataBR(ctx.seguinte.data)}.` }
  }
  const litrosLanc = lancado.litros == null ? null : round2(Number(lancado.litros))
  if (round2(L) === litrosLanc && round2(V) === round2(Number(lancado.valor)) && K === kmLancado)
    return { erro: 'Nada foi alterado.' }
  return { valores: { litros: round2(L), valor: round2(V), km: K } }
}

// ---------------------------------------------------------------- histórico

export interface CorrecaoAudit {
  registro_id: string | null
  created_at: string
  usuario_email?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any
}

/**
 * Valor ORIGINAL do KM de um lançamento já corrigido (o `antes` da 1ª correção).
 * null quando não houve correção ou quando o valor atual voltou ao original
 * (aí a tela não mostra "era X km").
 */
export function valorOriginalKm(
  correcoes: CorrecaoAudit[],
  registroId: string,
  valorAtual: number
): number | null {
  const doRegistro = correcoes
    .filter((c) => c.registro_id === registroId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const primeiro = doRegistro[0]?.dados?.antes?.km_atual
  if (primeiro == null) return null
  const original = Number(primeiro)
  return original === valorAtual ? null : original
}

export interface LinhaHistorico {
  quando: string
  quem: string
  email: string
  oque: string
  kmVeiculo: string | null
  antes: string
  depois: string
  motivo: string
}

const fmtQuando = (iso: string) => {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function camposAbastecimento(o: any): string {
  const partes: string[] = []
  if (o && 'litros' in o) partes.push(o.litros == null ? '— L' : `${fmtLitros(Number(o.litros))} L`)
  if (o && 'valor' in o) partes.push(o.valor == null ? '—' : fmtBrl(Number(o.valor)))
  if (o && 'km' in o) partes.push(`${o.km == null ? '—' : fmtKm(Number(o.km))} km`)
  return partes.join(' · ')
}

/** Uma linha da aba "Histórico de correções" (mockup seção 4, r4hist). */
export function linhaHistoricoCorrecao(c: CorrecaoAudit): LinhaHistorico {
  const d = c.dados ?? {}
  const autor = d.autor ?? {}
  const email: string = autor.email ?? c.usuario_email ?? ''
  const nome: string = autor.nome || email || '—'
  const quem = autor.papel ? `${nome} (${autor.papel})` : nome
  const ctx = d.contexto ?? {}
  const data: string = ctx.data ?? ''
  const motivo: string = d.motivo ? String(d.motivo) : '—'

  if (d.tipo === 'correcao_km') {
    const a = d.km_veiculo?.antes
    const b = d.km_veiculo?.depois
    return {
      quando: fmtQuando(c.created_at),
      quem,
      email,
      oque: `KM diário · ${ctx.equipe ?? '—'} · ${ctx.placa ?? '—'} · lançamento de ${data ? diaMes(data) : '—'}`,
      kmVeiculo: a != null && b != null && Number(a) !== Number(b)
        ? `KM atual do veículo recalculado: ${fmtKm(Number(a))} → ${fmtKm(Number(b))} km`
        : null,
      antes: d.antes?.km_atual != null ? `${fmtKm(Number(d.antes.km_atual))} km` : '—',
      depois: d.depois?.km_atual != null ? `${fmtKm(Number(d.depois.km_atual))} km` : '—',
      motivo,
    }
  }
  return {
    quando: fmtQuando(c.created_at),
    quem,
    email,
    oque: `Abastecimento · ${ctx.placa ?? '—'} · ${data ? diaMes(data) : '—'}`,
    kmVeiculo: null,
    antes: camposAbastecimento(d.antes) || '—',
    depois: camposAbastecimento(d.depois) || '—',
    motivo,
  }
}
