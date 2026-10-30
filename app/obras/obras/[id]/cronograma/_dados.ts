/**
 * Monta o que a tela do cronograma recebe (árvore + Gantt + gaveta) a partir
 * da leitura da obra. Puro: a página usa com o banco e a prévia visual
 * (`/obras/obras/previa`) usa com a fixture. Nunca leva peso/valor ao cliente.
 */
import type { ObraGrande } from '../../_lib/leitura'
import {
  compararComBase,
  deltaDiasUteis,
  resumirEtapas,
  type AtividadeCalculada,
  type ResultadoCronograma,
  type Situacao,
  type StatusAtividade,
} from '../../_lib/cronograma'
import { CORES_ETAPA } from '../../_ui/tema'
import type { DadosCronograma, LinhaAtividade, LinhaEtapa } from './_tipos'

/** Situação da linha de etapa: a pior das filhas; sem problema, andamento pelo %. */
function situacaoDaEtapa(as: AtividadeCalculada[]): { situacao: Situacao; status: StatusAtividade } {
  if (as.every((a) => a.situacao === 'concluida')) return { situacao: 'concluida', status: 'concluido' }
  for (const s of ['atrasada', 'aguardando_cliente', 'inicio_atrasado'] as const) {
    if (as.some((a) => a.situacao === s)) return { situacao: s, status: 'em_andamento' }
  }
  const andando = as.some((a) => a.status === 'em_andamento' || a.status === 'concluido' || a.percentual > 0)
  return { situacao: 'no_prazo', status: andando ? 'em_andamento' : 'nao_iniciado' }
}

type VersaoLinha = { id: string; numero: number; salva: boolean }

export function montarDadosCronograma(p: {
  obraDados: ObraGrande
  /** Cálculo da versão exibida (a do seletor). */
  exibida: ResultadoCronograma
  alvo: VersaoLinha
  versoes: VersaoLinha[]
  podeEditar: boolean
  hoje: string
}): DadosCronograma {
  const { obra, calc, calcBase, versaoVigente, rascunho, feriados } = p.obraDados
  const { exibida, alvo, podeEditar } = p

  const base = calcBase?.atividades ?? null
  const comp = compararComBase(exibida.atividades, base, feriados)
  // Sem peso_valor/peso no cliente: dado interno.
  const atividades: LinhaAtividade[] = exibida.atividades.map(({ pesoValor: _p, peso: _q, ...a }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const c = comp.get(a.numero)
    return { ...a, inicioBase: c?.inicioBase ?? null, fimBase: c?.fimBase ?? null, delta: c?.deltaDias ?? null }
  })

  const etapasBase = new Map(base ? resumirEtapas(base, feriados).map((e) => [e.etapa, e]) : [])
  const porNumero = new Map(exibida.atividades.map((a) => [a.numero, a]))
  const etapas: LinhaEtapa[] = resumirEtapas(exibida.atividades, feriados).map((e, i) => {
    const b = etapasBase.get(e.etapa)
    return {
      chave: e.etapa,
      nome: e.etapa || 'Sem etapa',
      cor: CORES_ETAPA[i % CORES_ETAPA.length],
      inicio: e.inicio,
      fim: e.fim,
      diasUteis: e.diasUteis,
      percentual: e.percentual,
      inicioProjetado: e.inicioProjetado,
      fimProjetado: e.fimProjetado,
      inicioBase: b?.inicio ?? null,
      fimBase: b?.fim ?? null,
      delta: b ? deltaDiasUteis(b.fim, e.fimProjetado, feriados) : null,
      ...situacaoDaEtapa(e.numeros.map((n) => porNumero.get(n)!)),
      numeros: e.numeros,
    }
  })

  return {
    obraId: obra.id,
    versao: alvo,
    versoes: p.versoes.map((x) => ({
      numero: x.numero,
      rotulo:
        (x.numero === 1 ? 'Base v1' : `v${x.numero}`) +
        (!x.salva ? ' · rascunho' : x.id === versaoVigente?.id ? ' · vigente' : ''),
    })),
    podeEditar,
    editavel: podeEditar && !alvo.salva,
    rascunho: rascunho ? { id: rascunho.id, numero: rascunho.numero } : null,
    temVigente: !!versaoVigente,
    temBase: !!calcBase,
    etapas,
    atividades,
    feriados: [...feriados],
    hoje: p.hoje,
    termino: { base: p.obraDados.terminoBase, previsto: exibida.terminoPrevisto, projetado: exibida.terminoProjetado },
    statusAtividades: (calc ?? exibida).atividades.map((a) => ({
      numero: a.numero, etapa: a.etapa, descricao: a.descricao, status: a.status, percentual: a.percentual,
      inicioPrevisto: a.inicioPrevisto, inicioReal: a.inicioReal, fimReal: a.fimReal,
      diasRestantes: a.diasRestantes, travada: a.travada,
    })),
    atividadeTrava: obra.atividade_trava ?? null,
  }
}
