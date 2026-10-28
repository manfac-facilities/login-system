'use server'

/**
 * Etapas 2 e 3 do Gestão de Frotas: envio de extratos Ticketlog/Veloe e os
 * cadastros que resolvem o centro de custo (cartão/tag -> equipe, equipe ->
 * centro de custo do Omie). Design:
 * docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md
 *
 * Só gestor de frotas ou admin (E1), perguntado ao banco (sofia_pode_gerir);
 * as policies de sdd-sql-sofia-extratos.sql repetem a regra. Tudo aqui é
 * INSERÇÃO: linha de extrato já gravada nunca é sobrescrita, e trocar
 * equipe/centro de custo é linha nova com vigente_desde.
 *
 * Sem `export type` neste arquivo: em 'use server' derruba a tela em runtime.
 * Nome de motorista não é lido nem gravado (lib/sofia/extratos/ não o lê).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'
import { lerTicketlog } from '@/lib/sofia/extratos/ticketlog'
import { lerVeloe } from '@/lib/sofia/extratos/veloe'
import { ErroExtrato, type LinhaExtrato, type Plataforma } from '@/lib/sofia/extratos/tipos'
import { codigoNumerico, dataIso, decimalDeTexto } from '@/lib/sofia/extratos/comum'
import { acharDivergencias, type Divergencia } from '@/lib/sofia/extratos/agrupar'

type ResultadoEnvio = {
  linhas: number
  novas: number
  existentes: number
  semCentroCusto: number
  periodo: { inicio: string; fim: string }
  saldo: string
  /** D4: código já gravado com valor diferente do arquivo (nada foi sobrescrito) */
  divergentes: Divergencia[]
}
type EstadoEnvio = { error?: string; resultado?: ResultadoEnvio }
type Estado = { error?: string; success?: boolean }

const ROTA = '/sofia/extratos'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function plataformaDe(v: FormDataEntryValue | null): Plataforma | null {
  return v === 'ticketlog' || v === 'veloe' ? v : null
}

function textoDe(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** "AAAA-MM-DD" válido (é o que o <input type="date"> manda). */
function dataDe(v: FormDataEntryValue | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textoDe(v))
  return m ? dataIso(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

/**
 * Saldo digitado: "1.234,56", "1234,56", "R$ 1.234,56", "1234.5", "0".
 * Sem vírgula, ponto só como decimal com até 2 casas ("1.234" é recusado:
 * ambíguo). Negativo é recusado (carteira pré-paga).
 */
function saldoDe(v: FormDataEntryValue | null): string | null {
  const s = textoDe(v).replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!s) return null
  const d = decimalDeTexto(s, 2, s.includes(',') ? 'br' : 'ponto')
  return d === null || d === 'casas' ? null : d
}

export async function enviarExtratoAction(_prev: EstadoEnvio, formData: FormData): Promise<EstadoEnvio> {
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const plataforma = plataformaDe(formData.get('plataforma'))
  if (!plataforma) return { error: 'Escolha a plataforma: Ticketlog ou Veloe.' }

  const saldo = saldoDe(formData.get('saldo'))
  if (saldo === null) {
    return { error: 'Informe o saldo atual que a plataforma mostra, com vírgula nos centavos (ex.: 1.234,56).' }
  }

  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: 'Escolha o arquivo do extrato.' }

  let linhas: LinhaExtrato[]
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    linhas = plataforma === 'ticketlog' ? await lerTicketlog(bytes) : lerVeloe(bytes)
  } catch (e) {
    if (e instanceof ErroExtrato) return { error: e.message }
    return { error: 'Não deu para ler o arquivo. Nada foi gravado.' }
  }

  // D4: lê o que já está gravado ANTES de enviar, para listar os repetidos com valor diferente.
  // Só leitura; se falhar, nada é enviado.
  const gravadas: { codigo_transacao: string; valor: string | number }[] = []
  for (let i = 0; i < linhas.length; i += 100) {
    const { data: lote, error: erroLeitura } = await supabase
      .from('sofia_extrato_linhas')
      .select('codigo_transacao, valor')
      .eq('plataforma', plataforma)
      .in('codigo_transacao', linhas.slice(i, i + 100).map((l) => l.codigo_transacao))
    if (erroLeitura) return { error: 'Não deu para conferir os códigos já gravados. Nada foi gravado.' }
    gravadas.push(...(lote ?? []))
  }
  const divergentes = acharDivergencias(linhas, gravadas)

  const { data, error } = await supabase.rpc('sofia_registrar_extrato', {
    p_plataforma: plataforma,
    p_arquivo: arquivo.name,
    p_saldo: saldo,
    p_linhas: linhas,
  })
  if (error) return { error: error.code === 'SOF01' ? error.message : 'Erro ao gravar o extrato. Nada foi gravado.' }

  const r = data as Record<string, unknown> | null
  const num = (k: string) => (typeof r?.[k] === 'number' ? (r[k] as number) : null)
  const [total, novas, existentes, sem] = [num('linhas'), num('novas'), num('existentes'), num('sem_centro_custo')]
  if (total === null || novas === null || existentes === null || sem === null
      || typeof r?.periodo_inicio !== 'string' || typeof r?.periodo_fim !== 'string') {
    return { error: 'O banco não confirmou o envio. Confira a lista de envios antes de mandar de novo.' }
  }

  revalidatePath(ROTA)
  return {
    resultado: {
      linhas: total,
      novas,
      existentes,
      semCentroCusto: sem,
      periodo: { inicio: r.periodo_inicio, fim: r.periodo_fim },
      saldo,
      divergentes,
    },
  }
}

/** Cartão Ticketlog / tag Veloe -> equipe a partir de vigente_desde. Linha nova sempre. */
export async function criarLigacaoAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const plataforma = plataformaDe(formData.get('plataforma'))
  if (!plataforma) return { error: 'Escolha a plataforma: Ticketlog ou Veloe.' }
  const identificador = codigoNumerico(textoDe(formData.get('identificador')))
  if (!identificador) {
    return { error: plataforma === 'ticketlog' ? 'Informe o número do cartão (só dígitos).' : 'Informe o número da tag (só dígitos).' }
  }
  const equipe_id = textoDe(formData.get('equipe_id'))
  if (!UUID.test(equipe_id)) return { error: 'Escolha a equipe.' }
  const vigente_desde = dataDe(formData.get('vigente_desde'))
  if (!vigente_desde) return { error: 'Informe a data a partir da qual a ligação vale.' }

  const { error } = await supabase
    .from('sofia_extrato_ligacoes')
    .insert({ plataforma, identificador, equipe_id, vigente_desde })
  if (error) return { error: error.code === '23503' ? 'Equipe não encontrada.' : 'Erro ao salvar a ligação' }

  revalidatePath(ROTA)
  return { success: true }
}

/** Equipe -> centro de custo do Omie a partir de vigente_desde. Linha nova sempre (E3). */
export async function novaVigenciaCentroCustoAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const equipe_id = textoDe(formData.get('equipe_id'))
  if (!UUID.test(equipe_id)) return { error: 'Escolha a equipe.' }
  const codigo = textoDe(formData.get('codigo'))
  if (!codigo) return { error: 'Informe o código do centro de custo no Omie.' }
  const nome = textoDe(formData.get('nome'))
  if (!nome) return { error: 'Informe o nome do centro de custo.' }
  const vigente_desde = dataDe(formData.get('vigente_desde'))
  if (!vigente_desde) return { error: 'Informe a data a partir da qual o centro de custo vale.' }

  const { error } = await supabase
    .from('sofia_equipe_centro_custo')
    .insert({ equipe_id, codigo, nome, vigente_desde })
  if (error) return { error: error.code === '23503' ? 'Equipe não encontrada.' : 'Erro ao salvar o centro de custo' }

  revalidatePath(ROTA)
  return { success: true }
}
