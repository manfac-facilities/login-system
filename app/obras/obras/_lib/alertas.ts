/**
 * Faixa de alertas do painel da obra (Leva 3 §2.4, SGO §5; comunicações pela
 * agenda desde a Leva 4). Puro: calcula a partir do que o painel já leu. Só
 * aparece o que estiver valendo.
 */
import type { ItemAgenda } from './agenda'
import type { ResultadoCronograma } from './cronograma'
import type { Restricao } from './last-planner'
import { avisoLocacao, textoAviso } from './locacao'
import { linkPedirMaterial, type AvisoMaterial } from './material'
import { diasDesde, LIMITE_DIAS_AGUARDANDO } from './medicao'

export type Alerta = {
  id:
    | 'atrasadas' | 'desvio' | 'comunicacao_atrasada' | 'comunicacao_hoje' | 'cliente' | 'vencidas' | 'locacao'
    | 'medicao_cliente' | 'medicao_fornecedor' | 'material'
  tom: 'negativo' | 'atencao'
  texto: string
  /** `externo`: outra app (Compras) — `<a>` comum em nova aba, nunca next/link. */
  acao: { rotulo: string; href: string; externo?: boolean }
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const num1 = (x: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x)

const ROTULO: Record<ItemAgenda['tipo'], string> = {
  diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', fase: 'Relatório de fase', entrega: 'Relatório de entrega',
}
/** Rótulo curto do item. Fase: sem o numero (a data prevista identifica). */
export const rotuloItem = (i: Pick<ItemAgenda, 'tipo' | 'referencia' | 'dataPrevista'>) =>
  i.tipo === 'mensal' ? `Mensal ${i.referencia.slice(5, 7)}/${i.referencia.slice(0, 4)}`
  : i.tipo === 'entrega' ? ROTULO.entrega
  : `${ROTULO[i.tipo]} de ${ddmm(i.dataPrevista)}`

/** Link do rascunho do item (diário da data, semanal da segunda, relatório de período). */
export function hrefDoItem(obraId: string, i: Pick<ItemAgenda, 'tipo' | 'referencia'>): string {
  const raiz = `/obras/obras/${obraId}`
  if (i.tipo === 'diario') return `${raiz}/diario?data=${i.referencia}`
  if (i.tipo === 'semanal') return `${raiz}/comunicacao/semanal?semana=${i.referencia}`
  return `${raiz}/comunicacao/relatorio/${i.tipo}/${i.referencia}`
}

export function calcularAlertas(p: {
  obraId: string
  hoje: string
  calc: ResultadoCronograma | null
  /**
   * Agenda de comunicação (`agendaDaObra`); null = leitura falhou ou sem
   * agenda: não há alerta de comunicação (nunca alerta em falso).
   */
  agenda: ItemAgenda[] | null
  restricoes: Restricao[]
  /**
   * Locações da obra (`obras_fin_locacoes`, Fases B/C §2.9) com o calendário da obra.
   * Ausente/null = leitura falhou: sem alerta de locação (nunca alerta em falso).
   */
  locacoes?: { item: string; fim: string | null; estado: string | null }[] | null
  feriados?: ReadonlySet<string>
  /**
   * Medições ao cliente da família (`obras_medicao_cliente`; a RLS só devolve a quem vê valores).
   * Ausente/null = leitura falhou ou sem permissão: sem alerta. Nunca leva R$.
   */
  medicoesCliente?: { numero: number; os: string | null; enviadaEm: string; situacao: string }[] | null
  /** `obras_fin_medicoes_fornecedor_atrasadas` (já > 10 dias); ausente/null = sem alerta. */
  medicoesFornecedor?: { fornecedor: string | null; dias: number; aguardando: string | null }[] | null
  /** Avisos do material antecipado (`avisosMaterial`), já ordenados; ausente/null = leitura falhou: sem alerta. */
  material?: AvisoMaterial[] | null
}): Alerta[] {
  const raiz = `/obras/obras/${p.obraId}`
  const out: Alerta[] = []

  const atrasadas = (p.calc?.atividades ?? []).filter((a) => a.situacao === 'atrasada' || a.situacao === 'inicio_atrasado').length
  if (atrasadas > 0) {
    out.push({
      id: 'atrasadas', tom: 'negativo',
      texto: `${plural(atrasadas, 'atividade atrasada', 'atividades atrasadas')} — comunicar o cliente hoje`,
      acao: { rotulo: 'Comunicação imediata', href: `${raiz}/comunicacao` },
    })
  }

  if (p.calc && p.calc.desvioPP < -5) {
    out.push({
      id: 'desvio', tom: 'negativo',
      texto: `Desvio de −${num1(-p.calc.desvioPP)} p.p. — definir ação de recuperação e registrar no semanal`,
      acao: { rotulo: 'Abrir semanal', href: `${raiz}/comunicacao/semanal` },
    })
  }

  // Comunicações da agenda (qualquer tipo): ATRASADO e ENVIAR HOJE (agenda vem ordenada por data prevista).
  const agenda = `${raiz}/comunicacao?aba=agenda`
  const atrasados = (p.agenda ?? []).filter((i) => i.situacao === 'atrasado')
  if (atrasados.length > 0) {
    const um = atrasados.length === 1
    out.push({
      id: 'comunicacao_atrasada', tom: 'atencao',
      texto: um
        ? `${rotuloItem(atrasados[0])} atrasado, sem envio ao cliente`
        : `${atrasados.length} comunicações atrasadas, a mais antiga: ${rotuloItem(atrasados[0])}`,
      acao: um ? { rotulo: 'Abrir rascunho', href: hrefDoItem(p.obraId, atrasados[0]) } : { rotulo: 'Ver agenda', href: agenda },
    })
  }
  const hoje = (p.agenda ?? []).filter((i) => i.situacao === 'enviar_hoje')
  if (hoje.length > 0) {
    const um = hoje.length === 1
    out.push({
      id: 'comunicacao_hoje', tom: 'atencao',
      texto: `Enviar hoje: ${hoje.map(rotuloItem).join(', ')}`,
      acao: um ? { rotulo: 'Abrir rascunho', href: hrefDoItem(p.obraId, hoje[0]) } : { rotulo: 'Ver agenda', href: agenda },
    })
  }

  const abertas = p.restricoes.filter((r) => r.situacao !== 'liberada')
  const doCliente = abertas.filter((r) => r.responsavel === 'cliente').length
  if (doCliente > 0) {
    out.push({
      id: 'cliente', tom: 'atencao',
      texto: `${plural(doCliente, 'decisão/restrição aguardando', 'decisões/restrições aguardando')} o cliente`,
      acao: { rotulo: 'Ver quadro', href: `${raiz}/lookahead?aba=quadro&resp=cliente` },
    })
  }
  const vencidas = abertas.filter((r) => r.prazo && r.prazo < p.hoje).length
  if (vencidas > 0) {
    out.push({
      id: 'vencidas', tom: 'negativo',
      texto: `${plural(vencidas, 'restrição vencida', 'restrições vencidas')}`,
      acao: { rotulo: 'Ver quadro', href: `${raiz}/lookahead?aba=quadro&atrasadas=1` },
    })
  }

  const avisos = (p.locacoes ?? [])
    .map((l) => ({ item: l.item, aviso: avisoLocacao(l, p.hoje, p.feriados ?? new Set()) }))
    .filter((x): x is { item: string; aviso: NonNullable<typeof x.aviso> } => x.aviso !== null)
    .sort((a, b) => a.aviso.fim.localeCompare(b.aviso.fim))
  if (avisos.length > 0) {
    const urgente = avisos.some((x) => x.aviso.tipo !== 'proxima')
    const primeira = `${avisos[0].item} ${textoAviso(avisos[0].aviso)}`
    out.push({
      id: 'locacao', tom: urgente ? 'negativo' : 'atencao',
      texto: avisos.length === 1
        ? `Locação: ${primeira} — devolver ou renovar`
        : `${avisos.length} locações vencendo, a primeira: ${primeira}`,
      acao: { rotulo: 'Ver locações', href: `${raiz}/financeiro/locacoes` },
    })
  }

  const aguardando = (p.medicoesCliente ?? [])
    .filter((m) => m.situacao === 'enviada')
    .map((m) => ({ ...m, dias: diasDesde(m.enviadaEm, p.hoje) }))
    .filter((m) => m.dias > LIMITE_DIAS_AGUARDANDO)
    .sort((a, b) => b.dias - a.dias)
  if (aguardando.length > 0) {
    const m = aguardando[0]
    out.push({
      id: 'medicao_cliente', tom: 'atencao',
      texto: aguardando.length === 1
        ? `Medição ${m.numero}${m.os ? ` da OS ${m.os}` : ''} há ${m.dias} dias aguardando o cliente`
        : `${aguardando.length} medições ao cliente há mais de ${LIMITE_DIAS_AGUARDANDO} dias aguardando aprovação, a mais antiga há ${m.dias} dias`,
      acao: { rotulo: 'Ver medições', href: `${raiz}/financeiro/medicoes` },
    })
  }

  const frn = [...(p.medicoesFornecedor ?? [])].sort((a, b) => b.dias - a.dias)
  if (frn.length > 0) {
    const m = frn[0]
    out.push({
      id: 'medicao_fornecedor', tom: 'atencao',
      texto: frn.length === 1
        ? `Medição de fornecedor${m.fornecedor ? ` (${m.fornecedor})` : ''} há ${m.dias} dias em aprovação — aguardando ${m.aguardando === 'engenheiro' ? 'o engenheiro' : 'o Eduardo'}`
        : `${frn.length} medições de fornecedor há mais de ${LIMITE_DIAS_AGUARDANDO} dias em aprovação, a mais antiga há ${m.dias} dias`,
      acao: { rotulo: 'Ver financeiro', href: `${raiz}/financeiro` },
    })
  }
  // Material antecipado (spec §4.5/§5.4): um alerta por aviso, com a cadeia e o botão para onde se resolve.
  for (const m of p.material ?? []) {
    out.push({
      id: 'material',
      tom: m.nivel === 'vermelho' ? 'negativo' : 'atencao',
      texto: `${m.titulo} — ${m.cadeia.join(' ← ')}`,
      acao: acaoMaterial(p, m),
    })
  }
  return out
}

function acaoMaterial(p: { obraId: string; calc: ResultadoCronograma | null; restricoes: Restricao[] }, m: AvisoMaterial): Alerta['acao'] {
  const raiz = `/obras/obras/${p.obraId}`
  if (m.destino === 'diario') return { rotulo: 'Responder', href: `${raiz}/diario` }
  const restricao = m.restricaoId ? p.restricoes.find((r) => r.id === m.restricaoId) : undefined
  const a = p.calc?.atividades.find((x) => x.numero === m.atividade)
  if (m.destino === 'compras' && restricao && a) {
    return {
      rotulo: 'Pedir no Compras',
      href: linkPedirMaterial({ obraId: p.obraId, restricao, atividade: { numero: a.numero, nome: a.descricao, inicio: m.inicio } }),
      externo: true,
    }
  }
  return { rotulo: 'Ver restrição', href: `${raiz}/lookahead${m.restricaoId ? `?restricao=${encodeURIComponent(m.restricaoId)}` : ''}` }
}
