/**
 * Faixa de alertas do painel da obra (Leva 3 §2.4, SGO §5; comunicações pela
 * agenda desde a Leva 4). Puro: calcula a partir do que o painel já leu. Só
 * aparece o que estiver valendo.
 */
import type { ItemAgenda } from './agenda'
import type { ResultadoCronograma } from './cronograma'
import type { Restricao } from './last-planner'

export type Alerta = {
  id: 'atrasadas' | 'desvio' | 'comunicacao_atrasada' | 'comunicacao_hoje' | 'cliente' | 'vencidas'
  tom: 'negativo' | 'atencao'
  texto: string
  acao: { rotulo: string; href: string }
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
  return out
}
