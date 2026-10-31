/**
 * Faixa de alertas do painel da obra (Leva 3 §2.4, SGO §5). Puro: calcula a
 * partir do que o painel já leu. Só aparece o que estiver valendo.
 */
import { ehDiaUtil } from './calendario'
import type { ResultadoCronograma } from './cronograma'
import { dataEnvioSemanal, segundaDaSemana, type Restricao } from './last-planner'

export type Alerta = {
  id: 'atrasadas' | 'desvio' | 'diario' | 'semanal' | 'cliente' | 'vencidas'
  tom: 'negativo' | 'atencao'
  texto: string
  acao: { rotulo: string; href: string }
}

const DIA_MS = 86_400_000
const somar = (d: string, n: number) => {
  const [a, m, x] = d.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, x) + n * DIA_MS).toISOString().slice(0, 10)
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const num1 = (x: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x)

/** Último dia útil antes de `hoje` (até 30 dias para trás). */
function diaUtilAnterior(hoje: string, feriados: ReadonlySet<string>): string | null {
  for (let i = 1; i <= 30; i++) {
    const d = somar(hoje, -i)
    if (ehDiaUtil(d, feriados)) return d
  }
  return null
}

export function calcularAlertas(p: {
  obraId: string
  hoje: string
  calc: ResultadoCronograma | null
  /** Base (v1) salva: diário e semanal só cobram depois disso. */
  baseSalva: boolean
  dataBase: string | null
  feriados: ReadonlySet<string>
  /** Data do último diário que o cliente recebeu (`ultimosDiariosEnviados`). */
  ultimoDiarioEnviado: string | null
  semanais: { semanaInicio: string; estado: string }[]
  restricoes: Restricao[]
}): Alerta[] {
  const raiz = `/obras/obras/${p.obraId}`
  const out: Alerta[] = []
  const iniciou = p.baseSalva && !!p.dataBase

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

  // Diário do último dia útil passado que o cliente não recebeu.
  const ontem = diaUtilAnterior(p.hoje, p.feriados)
  if (iniciou && ontem && ontem >= p.dataBase! && (!p.ultimoDiarioEnviado || p.ultimoDiarioEnviado < ontem)) {
    out.push({
      id: 'diario', tom: 'atencao',
      texto: `Diário de ${ddmm(ontem)} sem envio ao cliente`,
      acao: { rotulo: 'Abrir diário', href: `${raiz}/diario?data=${ontem}` },
    })
  }

  // Semanal: o desta semana a partir da data de envio; antes dela, o da semana passada.
  const atual = segundaDaSemana(p.hoje)
  const alvo = p.hoje >= dataEnvioSemanal(atual, p.feriados) ? atual : somar(atual, -7)
  const envioAlvo = dataEnvioSemanal(alvo, p.feriados)
  const estadoAlvo = p.semanais.find((s) => s.semanaInicio === alvo)?.estado
  if (iniciou && p.dataBase! <= envioAlvo && estadoAlvo !== 'enviado') {
    out.push({
      id: 'semanal', tom: 'atencao',
      texto: `Semanal de ${ddmm(envioAlvo)} não enviado`,
      acao: { rotulo: 'Abrir semanal', href: `${raiz}/comunicacao/semanal?semana=${alvo}` },
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
