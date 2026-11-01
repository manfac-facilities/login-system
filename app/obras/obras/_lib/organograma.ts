/**
 * Organograma do cliente (Fases B/C §2.2) × as tabelas que já mandam: `obras_destinatario`
 * (envios) e `obras_portal_acesso` (página do cliente). O organograma é o cadastro; os chips
 * gravam pelas actions existentes das Configurações, chaveadas pelo e-mail. Puro.
 */
import type { Destinatario, DestinatarioEntrada, TipoEnvio } from '../[id]/configuracoes/_tipos'
import type { AcessoPortal } from '../[id]/configuracoes/_tipos-portal'
import { emailInterno } from './portal-email'

export type Pessoa = { id: string; nome: string; cargo: string | null; email: string | null; ordem: number }

export const CHIPS_ENVIO: { tipo: TipoEnvio; rotulo: string }[] = [
  { tipo: 'diario', rotulo: 'Diário' },
  { tipo: 'semanal', rotulo: 'Semanal' },
  { tipo: 'mensal', rotulo: 'Mensal' },
  { tipo: 'imediato', rotulo: 'Imediato' },
]

const chave = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

export type EstadoChips = {
  destinatario: Destinatario | null
  acesso: AcessoPortal | null
  portal: boolean
  envio: Record<TipoEnvio, boolean>
}

/** Estado dos chips de um e-mail, lido das duas tabelas. Inativo = chip apagado. */
export function estadoChips(email: string, destinatarios: Destinatario[], acessos: AcessoPortal[]): EstadoChips {
  const e = chave(email)
  const destinatario = destinatarios.find((d) => chave(d.email) === e) ?? null
  const acesso = acessos.find((a) => chave(a.email) === e) ?? null
  const ligado = (t: TipoEnvio) => !!destinatario && destinatario.ativo && destinatario.tipos.includes(t)
  return {
    destinatario,
    acesso,
    portal: !!acesso && acesso.ativo,
    envio: { diario: ligado('diario'), semanal: ligado('semanal'), mensal: ligado('mensal'), imediato: ligado('imediato') },
  }
}

/**
 * O que gravar em `obras_destinatario` ao tocar um chip de envio (vai para `salvarDestinatarioAction`).
 * - sem linha: cria do lado cliente com esse tipo;
 * - com linha: liga/desliga só esse tipo, preservando nome, função, lado e os outros tipos;
 * - desligar o último tipo desativa a linha (os tipos ficam como estavam: a action exige ao menos um).
 * Linha inativa conta como "nenhum tipo": ligar um tipo nela reativa só com ele.
 */
export function destinatarioAposChip(
  pessoa: { nome: string; cargo: string | null; email: string },
  atual: Destinatario | null,
  tipo: TipoEnvio,
  ligar: boolean,
): DestinatarioEntrada | null {
  if (!atual) {
    if (!ligar) return null
    // E-mail da Manfac nunca vira destinatário do lado cliente (a tela nem mostra os chips para ele).
    const lado = emailInterno(pessoa.email) ? 'interno' : 'cliente'
    return { email: chave(pessoa.email), nome: pessoa.nome, funcao: pessoa.cargo, lado, tipos: [tipo], ativo: true }
  }
  const base = atual.ativo ? atual.tipos : []
  const tipos = ligar ? [...new Set([...base, tipo])] : base.filter((t) => t !== tipo)
  if (tipos.length === 0) return { ...atual, ativo: false }
  return { ...atual, tipos, ativo: true }
}

export type ForaDoOrganograma = {
  email: string
  nome: string | null
  funcao: string | null
  destinatario: Destinatario | null
  acesso: AcessoPortal | null
}

/**
 * Quem já recebe envio do lado cliente ou tem acesso ao portal e NÃO está no organograma
 * (por e-mail). Mostrado à parte para nada sumir em silêncio. Os internos ficam nas Configurações.
 */
export function foraDoOrganograma(pessoas: Pessoa[], destinatarios: Destinatario[], acessos: AcessoPortal[]): ForaDoOrganograma[] {
  const noOrg = new Set(pessoas.map((p) => chave(p.email)).filter(Boolean))
  const porEmail = new Map<string, ForaDoOrganograma>()
  for (const d of destinatarios) {
    const e = chave(d.email)
    if (d.lado !== 'cliente' || noOrg.has(e)) continue
    porEmail.set(e, { email: e, nome: d.nome, funcao: d.funcao, destinatario: d, acesso: null })
  }
  for (const a of acessos) {
    const e = chave(a.email)
    if (noOrg.has(e)) continue
    const x = porEmail.get(e)
    if (x) x.acesso = a
    else porEmail.set(e, { email: e, nome: a.nome, funcao: null, destinatario: null, acesso: a })
  }
  return [...porEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
}

/** Nova ordem depois de mover uma pessoa uma posição (lista já ordenada). Devolve só quem muda. */
export function reordenar(pessoas: Pessoa[], id: string, direcao: 'cima' | 'baixo'): { id: string; ordem: number }[] {
  const lista = [...pessoas]
  const i = lista.findIndex((p) => p.id === id)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return []
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return lista.map((p, k) => ({ id: p.id, ordem: k })).filter((x, k) => lista[k].ordem !== x.ordem)
}
