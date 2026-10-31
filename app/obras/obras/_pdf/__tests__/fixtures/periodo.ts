/**
 * Obra de teste dos relatórios de período: etapa Demolição (atividades 10, 20)
 * concluída em 06/11 antes da base (11/11); Alvenaria (30, 40) em andamento.
 * Tem R$ (pesoValor/valor), impedimento oculto e área interna da Manfac.
 */
import { diasUteisEntre } from '../../../_lib/calendario'
import { resumirEtapas, type AtividadeCalculada } from '../../../_lib/cronograma'
import type { ObraGrande } from '../../../_lib/leitura'
import { imp, obraGrandePdf } from './rdo'

export const ativ = (numero: number, over: Partial<AtividadeCalculada> = {}): AtividadeCalculada => {
  const a = {
    numero, etapa: 'E', descricao: `Atividade ${numero}`, pred1: null, pred2: null, duracao: 5, bloqueiaPorTrava: false,
    pesoValor: 98765, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
    inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-20',
    peso: 0.25, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
    alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
  } as AtividadeCalculada
  return { ...a, duracao: diasUteisEntre(a.inicioPrevisto, a.fimPrevisto, new Set()) }
}

export function obraPeriodo(p: { tudoConcluido?: boolean } = {}): ObraGrande {
  const og = obraGrandePdf({
    impedimentos: [
      imp({ id: 'cli', descricao: 'Liberação do estoque', abertoEm: '2026-10-27', encerradoEm: '2026-11-04', atividadeNumero: 30 }),
      imp({ id: 'oc', descricao: 'Pedreiro faltou sem avisar', responsavel: 'manfac', tipo: 'Equipe', exibirAoCliente: false, abertoEm: '2026-11-03', encerradoEm: '2026-11-04', atividadeNumero: null }),
    ],
  })
  og.obra = { ...og.obra, data_base: '2026-10-26' }
  const fim = p.tudoConcluido
    ? { status: 'concluido' as const, percentual: 1, inicioReal: '2026-11-09' }
    : null
  const atividades = [
    ativ(10, { etapa: 'Demolição', descricao: 'Demolição do piso', status: 'concluido', percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-11-03', fimPrevisto: '2026-11-04' }),
    ativ(20, { etapa: 'Demolição', descricao: 'Retirada de entulho', status: 'concluido', percentual: 1, inicioReal: '2026-10-28', fimReal: '2026-11-06', fimPrevisto: '2026-11-06' }),
    ativ(30, { etapa: 'Alvenaria', descricao: 'Alvenaria do depósito', status: 'em_andamento', percentual: 0.5, fimPrevisto: '2026-11-20', ...(fim ? { ...fim, fimReal: '2026-11-18' } : {}) }),
    ativ(40, { etapa: 'Alvenaria', descricao: 'Reboco', fimPrevisto: '2026-11-27', ...(fim ? { ...fim, fimReal: '2026-11-25' } : {}) }),
  ]
  og.calc = { ...og.calc!, atividades, previsto: 0.6, realizado: 0.62, terminoProjetado: '2026-11-27' }
  og.calcBase = {
    ...og.calc,
    atividades: [ativ(10, { fimPrevisto: '2026-11-05' }), ativ(20, { fimPrevisto: '2026-11-11' }), ativ(30, { fimPrevisto: '2026-11-20' }), ativ(40, { fimPrevisto: '2026-11-27' })],
  }
  og.etapas = resumirEtapas(atividades, og.feriados)
  og.plano = atividades.map(({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }) => ({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }))
  og.hist = [
    { numero: 10, dataStatus: '2026-10-30', percentual: 0.2 },
    { numero: 10, dataStatus: '2026-11-03', percentual: 1 },
    { numero: 20, dataStatus: '2026-11-06', percentual: 1 },
    { numero: 30, dataStatus: '2026-11-06', percentual: 0.5 },
  ]
  return og
}
