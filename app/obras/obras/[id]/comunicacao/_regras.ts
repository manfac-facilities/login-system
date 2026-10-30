/**
 * Regras puras da aba Comunicação (Leva 2 §3.1/§3.5, §6.1-3/4): validação do
 * registro manual, da ata e da imediata; janela de edição (autor até 24 h ou
 * admin — o banco confere de novo no trigger obras_registro_guarda) e a linha
 * do tempo (diários enviados + registros, mais recente primeiro).
 */
import { FUSO } from '../../../_lib/tipos'
import {
  TIPOS_REGISTRO,
  type Ata,
  type Envio,
  type FiltroLinha,
  type ImediataEntrada,
  type ItemLinha,
  type Registro,
  type RegistroEntrada,
} from './_tipos'

export const JANELA_EDICAO_MS = 24 * 60 * 60 * 1000

const ISO = /^\d{4}-\d{2}-\d{2}$/
export const dataValida = (s: unknown): s is string => {
  if (typeof s !== 'string' || !ISO.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

const limpo = (s: unknown) => (typeof s === 'string' ? s.trim() : '')
const nulo = (s: string) => (s ? s : null)

type Ok<T> = { ok: true; valor: T }
type Falha = { ok: false; erro: string }

export type RegistroLimpo = {
  tipo: RegistroEntrada['tipo']
  data: string
  participantes: string | null
  texto: string | null
  ata: Ata | null
}

/** Ata: pauta obrigatória; decisões/pendências vazias saem; prazo é data ou nada. */
export function validarAta(a: unknown): Ok<Ata> | Falha {
  const x = (a ?? {}) as Partial<Ata>
  const pauta = limpo(x.pauta)
  if (!pauta) return { ok: false, erro: 'Informe a pauta da reunião' }
  if (pauta.length > 2000) return { ok: false, erro: 'Pauta longa demais (até 2.000 caracteres)' }
  const decisoes = (Array.isArray(x.decisoes) ? x.decisoes : []).map(limpo).filter(Boolean)
  if (decisoes.length > 30) return { ok: false, erro: 'No máximo 30 decisões' }
  if (decisoes.some((d) => d.length > 500)) return { ok: false, erro: 'Cada decisão tem até 500 caracteres' }
  const pendencias = []
  for (const p of Array.isArray(x.pendencias) ? x.pendencias : []) {
    const oque = limpo(p?.oque)
    const responsavel = limpo(p?.responsavel)
    const prazo = limpo(p?.prazo)
    if (!oque && !responsavel && !prazo) continue
    if (!oque) return { ok: false, erro: 'Toda pendência precisa dizer o quê' }
    if (oque.length > 500 || responsavel.length > 120) return { ok: false, erro: 'Pendência longa demais' }
    if (prazo && !dataValida(prazo)) return { ok: false, erro: `Prazo inválido na pendência "${oque}"` }
    pendencias.push({ oque, responsavel, prazo: prazo || null })
  }
  if (pendencias.length > 30) return { ok: false, erro: 'No máximo 30 pendências' }
  return { ok: true, valor: { pauta, decisoes, pendencias } }
}

/** Registro manual: tipo da lista, data válida e não futura, texto (ou ata na reunião). */
export function validarRegistro(e: unknown, hoje: string): Ok<RegistroLimpo> | Falha {
  const x = (e ?? {}) as Partial<RegistroEntrada>
  const tipo = TIPOS_REGISTRO.find((t) => t.valor === x.tipo)?.valor
  if (!tipo) return { ok: false, erro: 'Escolha o tipo do registro' }
  if (!dataValida(x.data)) return { ok: false, erro: 'Data inválida' }
  if (x.data > hoje) return { ok: false, erro: 'A data não pode ser no futuro' }
  const participantes = limpo(x.participantes)
  const texto = limpo(x.texto)
  if (participantes.length > 2000) return { ok: false, erro: 'Participantes: até 2.000 caracteres' }
  if (texto.length > 5000) return { ok: false, erro: 'Texto longo demais (até 5.000 caracteres)' }
  let ata: Ata | null = null
  if (tipo === 'reuniao') {
    const a = validarAta(x.ata)
    if (!a.ok) return a
    ata = a.valor
  } else if (!texto) {
    return { ok: false, erro: 'Escreva o que foi tratado' }
  }
  return { ok: true, valor: { tipo, data: x.data, participantes: nulo(participantes), texto: nulo(texto), ata } }
}

export type ImediataLimpa = ImediataEntrada

export function validarImediata(e: unknown): Ok<ImediataLimpa> | Falha {
  const x = (e ?? {}) as Partial<ImediataEntrada>
  const assunto = limpo(x.assunto)
  const texto = limpo(x.texto)
  if (assunto.length < 3) return { ok: false, erro: 'Informe o assunto' }
  if (assunto.length > 150) return { ok: false, erro: 'Assunto: até 150 caracteres' }
  if (!texto) return { ok: false, erro: 'Escreva a comunicação' }
  if (texto.length > 5000) return { ok: false, erro: 'Texto longo demais (até 5.000 caracteres)' }
  if (x.nivel !== 'atencao' && x.nivel !== 'urgente') return { ok: false, erro: 'Escolha o nível (atenção ou urgente)' }
  const impedimentoId = limpo(x.impedimentoId) || null
  const atividadeNumero = x.atividadeNumero ?? null
  if (atividadeNumero !== null && !(Number.isInteger(atividadeNumero) && atividadeNumero > 0)) {
    return { ok: false, erro: 'Atividade inválida' }
  }
  return { ok: true, valor: { assunto, texto, nivel: x.nivel, impedimentoId, atividadeNumero } }
}

/** Autor (e-mail igual) até 24 h depois de criado, ou admin a qualquer tempo (§6.1-4). */
export function podeEditar(
  r: { criadoPor: string | null; criadoEm: string },
  email: string,
  admin: boolean,
  agora: Date = new Date(),
): boolean {
  if (admin) return true
  const autor = r.criadoPor?.trim().toLowerCase()
  if (!autor || autor !== email.trim().toLowerCase()) return false
  const criado = new Date(r.criadoEm).getTime()
  return Number.isFinite(criado) && agora.getTime() - criado < JANELA_EDICAO_MS
}

const diaLocal = (ts: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts))

/**
 * Momento do registro na linha do tempo: o próprio criado_em quando foi
 * registrado no dia do fato; se foi lançado depois (reunião de ontem), meio-dia
 * da data do fato — fica entre os envios daquele dia.
 */
export function quandoRegistro(r: { data: string; criadoEm: string }): string {
  if (diaLocal(r.criadoEm) === r.data) return new Date(r.criadoEm).toISOString()
  return new Date(`${r.data}T12:00:00-03:00`).toISOString()
}

/**
 * Linha do tempo: envios de diário (e envios órfãos de ata/imediata, cujo
 * registro foi apagado) + registros com os envios ligados a eles; mais recente
 * primeiro; filtro por tipo ('diario' = envios de diário).
 */
export function montarLinhaDoTempo(p: {
  envios: Envio[]
  registros: Registro[]
  filtro: FiltroLinha
  email: string
  admin: boolean
  agora?: Date
}): ItemLinha[] {
  const ids = new Set(p.registros.map((r) => r.id))
  const itens: ItemLinha[] = []
  for (const e of p.envios) {
    if (e.registroId && ids.has(e.registroId)) continue
    const tipo = e.tipo ?? 'diario'
    const passa =
      p.filtro === 'todos' ||
      (p.filtro === 'diario' && tipo === 'diario') ||
      (p.filtro === 'reuniao' && tipo === 'ata') ||
      (p.filtro === 'imediata' && tipo === 'imediata')
    if (passa) itens.push({ tipo: 'envio', chave: `e-${e.id}`, quando: new Date(e.enviadoEm).toISOString(), envio: e })
  }
  for (const r of p.registros) {
    if (p.filtro !== 'todos' && p.filtro !== r.tipo) continue
    itens.push({
      tipo: 'registro',
      chave: `r-${r.id}`,
      quando: quandoRegistro(r),
      registro: r,
      envios: p.envios
        .filter((e) => e.registroId === r.id)
        .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)),
      // Imediata já saiu por e-mail: não edita (apagar segue a regra do autor/admin).
      podeEditar: podeEditar(r, p.email, p.admin, p.agora),
    })
  }
  return itens.sort((a, b) => b.quando.localeCompare(a.quando))
}

export const FILTROS: { valor: FiltroLinha; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Tudo' },
  { valor: 'diario', rotulo: 'Diários' },
  { valor: 'reuniao', rotulo: 'Reuniões' },
  { valor: 'ligacao', rotulo: 'Ligações' },
  { valor: 'visita', rotulo: 'Visitas' },
  { valor: 'outro', rotulo: 'Outros' },
  { valor: 'imediata', rotulo: 'Imediatas' },
]

export const filtroDe = (s: string | undefined): FiltroLinha => FILTROS.find((f) => f.valor === s)?.valor ?? 'todos'
