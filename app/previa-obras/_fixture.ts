/**
 * Dados da prévia visual (só desenvolvimento): Macaé 3 (fixture dos testes)
 * com a base v1 salva, uma revisão v2 em rascunho, execução até 29/10/2026,
 * histórico de status e impedimentos sintéticos para os gráficos terem conteúdo.
 */
import type { ObraRow } from '../obras/_lib/tipos'
import type { AtividadeExec, AtividadePlano } from '../obras/obras/_lib/cronograma'
import type { PontoHist } from '../obras/obras/_lib/curvas'
import { calcularCronograma } from '../obras/obras/_lib/cronograma'
import { impedimentosCalcDe, montarObraGrande, type ImpedimentoRow, type ObraGrande } from '../obras/obras/_lib/leitura'
import { PLANO_MACAE3 } from '../obras/obras/_lib/__tests__/fixtures/macae3'
import { FERIADOS_MACAE } from '../obras/obras/_lib/__tests__/fixtures/feriados'

export const HOJE = '2026-10-29'
export const OBRA_ID = 'previa'

const obra = {
  id: OBRA_ID,
  os: '48213',
  loja: 'Drogaria Macaé 3',
  cliente: 'DPSP',
  descricao: 'Reforço estrutural do mezanino e reforma light',
  modalidade: 'obra',
  data_base: '2026-10-05',
  engenheiro_email: 'engenheiro@manfac.com.br',
  atividade_trava: 10,
} as unknown as ObraRow

const exec = (
  numero: number,
  status: AtividadeExec['status'],
  percentual: number,
  inicioReal: string | null = null,
  fimReal: string | null = null,
): AtividadeExec => ({ numero, status, percentual, inicioReal, fimReal })

const EXEC: AtividadeExec[] = PLANO_MACAE3.map((a) => {
  switch (a.numero) {
    case 1: return exec(1, 'concluido', 1, '2026-10-05', '2026-10-05')
    case 2: return exec(2, 'concluido', 1, '2026-10-06', '2026-10-07')
    case 3: return exec(3, 'concluido', 1, '2026-10-06', '2026-10-08')
    case 4: return exec(4, 'concluido', 1, '2026-10-09', '2026-10-13')
    case 5: return exec(5, 'concluido', 1, '2026-10-09', '2026-10-09')
    case 6: return exec(6, 'concluido', 1, '2026-10-13', '2026-10-16')
    case 7: return exec(7, 'concluido', 1, '2026-10-19', '2026-10-21')
    case 8: return exec(8, 'em_andamento', 0.6, '2026-10-19')
    case 23: return exec(23, 'em_andamento', 0.2, '2026-10-27')
    default: return exec(a.numero, 'nao_iniciado', 0)
  }
})

/** Histórico de status: fechamento de cada semana + avanços pontuais. */
const HIST: PontoHist[] = [
  { numero: 1, dataStatus: '2026-10-05', percentual: 1 },
  { numero: 2, dataStatus: '2026-10-06', percentual: 0.5 },
  { numero: 2, dataStatus: '2026-10-07', percentual: 1 },
  { numero: 3, dataStatus: '2026-10-07', percentual: 0.5 },
  { numero: 3, dataStatus: '2026-10-08', percentual: 1 },
  { numero: 5, dataStatus: '2026-10-09', percentual: 1 },
  { numero: 4, dataStatus: '2026-10-09', percentual: 0.3 },
  { numero: 4, dataStatus: '2026-10-13', percentual: 1 },
  { numero: 6, dataStatus: '2026-10-14', percentual: 0.4 },
  { numero: 6, dataStatus: '2026-10-16', percentual: 1 },
  { numero: 7, dataStatus: '2026-10-20', percentual: 0.5 },
  { numero: 7, dataStatus: '2026-10-21', percentual: 1 },
  { numero: 8, dataStatus: '2026-10-21', percentual: 0.2 },
  { numero: 8, dataStatus: '2026-10-26', percentual: 0.4 },
  { numero: 8, dataStatus: '2026-10-28', percentual: 0.6 },
  { numero: 23, dataStatus: '2026-10-28', percentual: 0.2 },
]

const imp = (p: Partial<ImpedimentoRow> & Pick<ImpedimentoRow, 'id' | 'descricao' | 'abertoEm'>): ImpedimentoRow => ({
  obraId: OBRA_ID,
  categoria: 'impedimento',
  tipo: null,
  responsavel: null,
  atividadeNumero: null,
  pessoaCliente: null,
  fotoPath: null,
  travaAtividade: false,
  impactoDias: null,
  exibirAoCliente: true,
  encerradoEm: null,
  rdoId: null,
  orientacaoId: null,
  criadoPor: null,
  criadoEm: p.abertoEm + 'T12:00:00Z',
  ...p,
})

const IMPEDIMENTOS: ImpedimentoRow[] = [
  imp({
    id: 'i1', responsavel: 'cliente', tipo: 'acesso', atividadeNumero: 8, abertoEm: '2026-10-22', impactoDias: 2,
    descricao: 'Loja não liberou a abertura do piso no horário comercial', pessoaCliente: 'Gerente da loja',
  }),
  imp({
    id: 'i2', responsavel: 'terceiro', tipo: 'material', atividadeNumero: 23, abertoEm: '2026-10-27', impactoDias: 1,
    descricao: 'Fornecedor atrasou a entrega dos splits',
  }),
  imp({
    id: 'i3', responsavel: 'manfac', tipo: 'equipe', atividadeNumero: 6, abertoEm: '2026-10-13', encerradoEm: '2026-10-14',
    impactoDias: 1, descricao: 'Equipe de escoramento chegou um dia depois',
  }),
  imp({
    id: 'o1', categoria: 'orientacao', abertoEm: '2026-10-20',
    descricao: 'Cliente pediu manter o caixa 2 funcionando durante a obra',
  }),
]

/** Revisão v2 (rascunho): o projeto estrutural passa de 10 para 12 dias. */
const PLANO_V2: AtividadePlano[] = PLANO_MACAE3.map((a) => (a.numero === 9 ? { ...a, duracao: 12 } : a))

const feriados = new Set(FERIADOS_MACAE)

export const VERSOES = [
  { id: 'v1', numero: 1, salva: true },
  { id: 'v2', numero: 2, salva: false },
]

export function dadosDaPrevia(): ObraGrande {
  return montarObraGrande({
    obra,
    vigente: { id: 'v1', numero: 1, salvaEm: '2026-10-02T18:00:00Z', motivo: null },
    base: { id: 'v1', numero: 1, salvaEm: '2026-10-02T18:00:00Z', motivo: null },
    rascunho: { id: 'v2', numero: 2, salvaEm: null, motivo: null },
    planoUsado: PLANO_MACAE3,
    planoBase: null,
    exec: EXEC,
    impedimentos: IMPEDIMENTOS,
    feriados,
    hist: HIST,
    dadosAte: '2026-10-28',
    hoje: HOJE,
  })
}

/** Cálculo do rascunho v2 (a versão que o cronograma abre por padrão). */
export function calcDoRascunho(d: ObraGrande) {
  return calcularCronograma({
    plano: PLANO_V2, exec: d.exec, dataBase: obra.data_base!, hoje: HOJE, feriados: d.feriados,
    atividadeTrava: obra.atividade_trava, impedimentos: impedimentosCalcDe(d.impedimentos),
  })
}
