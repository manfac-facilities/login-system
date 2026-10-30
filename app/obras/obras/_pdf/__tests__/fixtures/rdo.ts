/** Obra e RDO de teste do PDF do diário: tem valor/peso em R$, impedimento oculto e causa da Manfac. */
import type { RdoCompleto } from '../../../_lib/email-diario'
import type { ImpedimentoRow, ObraGrande } from '../../../_lib/leitura'
import type { ObraRow } from '../../../../_lib/tipos'

export const imp = (over: Partial<ImpedimentoRow>): ImpedimentoRow => ({
  id: 'i', obraId: 'o1', categoria: 'impedimento', tipo: 'Área não liberada', responsavel: 'cliente',
  atividadeNumero: 2, descricao: 'Autorização de baixa das gôndolas', pessoaCliente: null, fotoPath: null,
  travaAtividade: true, impactoDias: null, exibirAoCliente: true, abertoEm: '2026-10-27', encerradoEm: null,
  rdoId: null, orientacaoId: null, criadoPor: null, criadoEm: '2026-10-27T10:00:00Z', ...over,
})

export function obraGrandePdf(over: Partial<ObraGrande> = {}): ObraGrande {
  const plano = Array.from({ length: 6 }, (_, i) => ({
    numero: i + 1, etapa: 'E', descricao: `Atividade ${i + 1}`, pred1: null, pred2: null, duracao: 5,
    bloqueiaPorTrava: false, pesoValor: 98765,
  }))
  plano[0].descricao = 'Demolição do piso'
  plano[2].descricao = 'Alvenaria do depósito'
  plano[3].descricao = 'Instalação elétrica'
  return {
    obra: {
      id: 'o1', os: 'OS-4321', cliente: 'DPSP', loja: 'DP Macaé 3', modalidade: 'obra', data_base: '2026-10-26',
      atividade_trava: null, engenheiro_email: 'eng@manfac.com.br', valor: 123456.78,
    } as unknown as ObraRow,
    versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
    versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
    rascunho: null,
    plano,
    exec: [],
    impedimentos: [
      imp({ id: 'c1' }),
      imp({
        id: 'm1', tipo: 'Material Manfac', responsavel: 'manfac', descricao: 'Atraso na entrega do perfil',
        atividadeNumero: null, travaAtividade: false, impactoDias: 1, abertoEm: '2026-10-28',
      }),
      imp({
        id: 'oculto', tipo: 'Equipe', responsavel: 'manfac', descricao: 'Pedreiro faltou sem avisar',
        atividadeNumero: null, travaAtividade: false, impactoDias: 0.5, exibirAoCliente: false, abertoEm: '2026-10-28',
      }),
      imp({ id: 'fechado', descricao: 'Já resolvido antes', travaAtividade: false, encerradoEm: '2026-10-28' }),
      imp({
        id: 'or1', categoria: 'orientacao', tipo: null, responsavel: null, atividadeNumero: null,
        descricao: 'Manter o corredor livre', pessoaCliente: 'Ana', travaAtividade: false, abertoEm: '2026-10-29',
        criadoEm: '2026-10-29T13:00:00Z',
      }),
      imp({
        id: 'or2', categoria: 'orientacao', tipo: null, responsavel: null, atividadeNumero: null,
        descricao: 'Orientação interna escondida', travaAtividade: false, exibirAoCliente: false, abertoEm: '2026-10-29',
      }),
    ],
    feriados: new Set<string>(),
    calc: {
      atividades: [], previsto: 0.08, realizado: 0.06, desvioPP: -2,
      terminoPrevisto: '2027-02-12', terminoProjetado: '2027-02-12',
    },
    calcBase: null,
    etapas: [],
    hist: [],
    dadosAte: null,
    terminoBase: '2027-02-12',
    sinal: 'amarelo',
    atraso: { total: 0, cliente: 0, manfac: 0, terceiro: 0, clima: 0 },
    ...over,
  } as ObraGrande
}

export const rdoPdf = (over: Partial<RdoCompleto> = {}): RdoCompleto => ({
  id: 'r1', data: '2026-10-29', semExecucao: false, motivoSemExecucao: null,
  programacaoAmanha: 'Concluir alvenaria e iniciar elétrica',
  climaManha: 'sol', climaTarde: 'chuva',
  avancos: [
    { numero: 1, de: 0.4, para: 1, concluida: true },
    { numero: 3, de: 0.2, para: 0.55, concluida: false },
    { numero: 4, de: 0.1, para: 0.1, concluida: false, causa: 'material' },
    { numero: 5, de: 0, para: 0, concluida: false, causa: 'projeto' },
  ],
  ...over,
})
