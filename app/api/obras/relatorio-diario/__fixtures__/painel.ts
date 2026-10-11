/**
 * Painéis fictícios para a imagem do e-mail — os estados "dia normal" e "quase
 * vazio" do mockup aprovado, montados com `montarPainel` sobre linhas inventadas.
 * Usados pelo teste da imagem e pela prévia (`scripts/previa-relatorio-diario.mts`).
 * Pasta `__fixtures__`: não é rota (prefixo `_`) nem suíte do jest (não é `__tests__`).
 */

import type { ObraRow } from '../../../../obras/_lib/tipos'
import {
  montarPainel,
  type Entrada,
  type LinhaDiario,
  type LinhaRemarcacao,
  type LinhaTarefa,
  type ObraPainel,
  type Painel,
} from '../../../../obras/painel/_calculos'

export const HOJE = '2026-10-08'
export const LIDO_EM = '08/10/2026 às 07:59'
const FILTRO = { cliente: null, mes: '2026-10', cmp: 'prev' as const }

function fabrica() {
  let seq = 0
  return (over: Partial<ObraRow> & { cliente?: string | null } = {}): ObraPainel => {
    seq++
    return {
      id: 'o' + seq,
      os: `0926-0170${String(seq).padStart(2, '0')}`,
      loja: `LOJA ${seq}`,
      descricao: null,
      tipo: 'CIVIL',
      valor: 50000,
      origem: null,
      fonte: 'field',
      field_id: null,
      field_ausente_desde: null,
      field_ausente_em: null,
      analista_cliente: null,
      pcm: null,
      equipe: 'Equipe Alfa',
      os_aprovada: false,
      liberado_por: null,
      liberado_em: null,
      etapa: 'andamento',
      bloqueio: 'Sem bloqueio',
      mau_uso: false,
      prioridade: null,
      aprovacao: null,
      inicio_plan: null,
      inicio_real: null,
      duracao: null,
      fim_real: null,
      desde_etapa: null,
      marco_exec_fim: null,
      marco_relatorio: null,
      marco_os_aprov: null,
      marco_fechou_os: null,
      marco_liberou_fat: null,
      marco_faturou: null,
      pendencia: null,
      pend_resp: null,
      pend_prazo: null,
      prox_acao: null,
      atualizacao: null,
      nao_andou_seguidos: 0,
      bloqueada_dias: 0,
      criado_por: null,
      created_at: '2026-08-01T12:00:00Z',
      updated_at: null,
      cliente: 'DPSP',
      ...over,
    } as ObraPainel
  }
}

const CLIENTES = ['DPSP', 'DPSP', 'D1000', 'DPSP', 'PROFARMA', 'D1000']
const EQUIPES = ['Equipe Alfa', 'Equipe Bravo', 'Equipe Delta', 'Equipe Charlie']
const LOJAS = [
  'DP ITABORAI',
  'DP SAO GONCALO',
  'D1000 NITEROI',
  'PROFARMA TIJUCA',
  'DP NOVA IGUACU',
  'D1000 BARRA',
  'DP DUQUE DE CAXIAS',
  'DP MARICA',
  'DP CAMPO GRANDE',
  'D1000 ICARAI',
]

/** Dia normal: 47 obras na carteira (9 sem valor), faturamento no mês, equipes, paradas, atrasos. */
export function entradaDiaNormal(): Entrada {
  const o = fabrica()
  const obras: ObraPainel[] = []
  const diario: LinhaDiario[] = []
  const tarefas: LinhaTarefa[] = []
  const remarcacoes: LinhaRemarcacao[] = []
  let i = 0
  const base = () => {
    const k = i++
    return { cliente: CLIENTES[k % CLIENTES.length], equipe: EQUIPES[k % EQUIPES.length], loja: LOJAS[k % LOJAS.length] }
  }
  const semValor = new Set([2, 5, 9, 14, 20, 27, 33, 38, 44])
  const v = (n: number) => (semValor.has(i) ? null : n)

  // Aguardando definição (5) e Levantamento (6) — a iniciar
  for (let k = 0; k < 5; k++) obras.push(o({ ...base(), etapa: 'definir', valor: v(36000) }))
  for (let k = 0; k < 6; k++)
    obras.push(
      o({
        ...base(),
        etapa: 'levantamento',
        valor: v(68000),
        inicio_plan: ['2026-10-03', '2026-10-12', '2026-10-15', '2026-10-20', '2026-10-27', '2026-11-04'][k],
        duracao: 6,
      })
    )
  // Em andamento (14): 3 atrasadas, as outras no prazo
  for (let k = 0; k < 14; k++) {
    const atrasada = k < 3
    const ob = o({
      ...base(),
      etapa: 'andamento',
      valor: v(122000),
      inicio_plan: atrasada ? '2026-09-18' : '2026-10-0' + (1 + (k % 7)),
      inicio_real: atrasada ? '2026-09-20' : '2026-10-0' + (2 + (k % 6)),
      duracao: atrasada ? 12 : 14,
      liberado_em: '2026-09-15',
      aprovacao: k < 6 ? '2026-10-0' + (2 + (k % 5)) : null,
    })
    obras.push(ob)
    if (k % 4 === 1) remarcacoes.push({ obra_id: ob.id, data: '2026-10-01', de: '2026-09-25', para: '2026-10-01', created_at: '2026-10-01T10:00:00Z' })
    diario.push({ obra_id: ob.id, data: HOJE, andou: k % 5 !== 0, motivo: k % 5 === 0 ? 'Clima' : null, foto_path: k % 2 ? 'f.jpg' : null })
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'])
      diario.push({ obra_id: ob.id, data: d, andou: true, motivo: null, foto_path: null })
  }
  // Paralisado (4)
  const motivos = ['Falta de material', 'Falta de material', 'Cliente / loja', 'Clima'] as const
  for (let k = 0; k < 4; k++)
    obras.push(
      o({
        ...base(),
        etapa: 'paralisado',
        valor: v([95000, 95000, 110000, 60000][k]),
        bloqueio: motivos[k],
        inicio_plan: '2026-09-28',
        inicio_real: '2026-09-29',
        duracao: 20,
        desde_etapa: '2026-10-03',
      })
    )
  // Fechamento: relatório (3), aprovar OS (2), fechar OS (2) — terminaram a execução no mês
  const fech = [
    ['relatorio', 90000, '2026-10-03'],
    ['relatorio', 90000, '2026-10-06'],
    ['relatorio', 90000, '2026-10-07'],
    ['aprovarOS', 95000, '2026-10-02'],
    ['aprovarOS', 95000, '2026-10-05'],
    ['fecharOS', 122500, '2026-10-01'],
    ['fecharOS', 122500, '2026-10-04'],
  ] as const
  for (const [etapa, valor, fim] of fech) {
    const ob = o({
      ...base(),
      etapa,
      valor: v(valor),
      inicio_plan: '2026-09-22',
      inicio_real: '2026-09-23',
      duracao: 7,
      fim_real: fim,
      marco_exec_fim: fim,
      liberado_em: '2026-09-10',
      aprovacao: etapa === 'fecharOS' ? '2026-10-06' : null,
    })
    obras.push(ob)
    for (const d of ['2026-09-29', '2026-09-30', '2026-10-01'])
      diario.push({ obra_id: ob.id, data: d, andou: true, motivo: null, foto_path: null })
  }
  // Pendente faturamento (11)
  for (let k = 0; k < 11; k++)
    obras.push(
      o({
        ...base(),
        etapa: 'pendFat',
        valor: v(82000 + k * 1000),
        marco_exec_fim: '2026-09-' + (10 + k),
        marco_liberou_fat: '2026-09-' + (15 + k),
        desde_etapa: '2026-09-' + (15 + k),
      })
    )
  // Faturadas: setembro (1,05 mi) e outubro (612 mil)
  const fat = [
    ['2026-09-03', 180000, '2026-08-25'],
    ['2026-09-06', 150000, '2026-08-29'],
    ['2026-09-08', 210000, '2026-09-01'],
    ['2026-09-17', 260000, '2026-09-05'],
    ['2026-09-25', 250000, '2026-09-12'],
    ['2026-10-02', 140000, '2026-09-25'],
    ['2026-10-03', 132000, '2026-09-19'],
    ['2026-10-06', 200000, '2026-09-30'],
    ['2026-10-07', 74000, '2026-09-23'],
    ['2026-10-08', 66000, '2026-10-01'],
  ] as const
  for (const [quando, valor, liberou] of fat)
    obras.push(
      o({
        ...base(),
        etapa: 'faturado',
        valor,
        marco_faturou: quando,
        marco_liberou_fat: liberou,
        marco_exec_fim: liberou,
        os_aprovada: true,
      })
    )
  // Tarefas
  for (let k = 0; k < 17; k++)
    tarefas.push({ obra_id: obras[11 + k].id, situacao: 'aberta', prazo: k < 4 ? '2026-10-05' : '2026-10-10', resposta_em: null })
  for (let k = 0; k < 22; k++)
    tarefas.push({ obra_id: obras[11 + (k % 14)].id, situacao: 'respondida', prazo: '2026-10-04', resposta_em: '2026-10-0' + (2 + (k % 6)) })
  return { obras, diario, tarefas, remarcacoes, hoje: HOJE }
}

/** Quase vazio: 47 obras, 31 sem valor, nada faturado no mês, nenhuma equipe nem parada. */
export function entradaQuaseVazio(): Entrada {
  const o = fabrica()
  const obras: ObraPainel[] = []
  let i = 0
  const base = () => {
    const k = i++
    return { cliente: CLIENTES[k % CLIENTES.length], equipe: EQUIPES[k % EQUIPES.length], loja: LOJAS[k % LOJAS.length] }
  }
  const comValor = (k: number) => k % 3 === 0
  const etapas: [ObraRow['etapa'], number][] = [
    ['definir', 9],
    ['levantamento', 11],
    ['andamento', 18],
    ['relatorio', 3],
    ['aprovarOS', 2],
    ['fecharOS', 1],
    ['pendFat', 3],
  ]
  for (const [etapa, n] of etapas)
    for (let k = 0; k < n; k++) {
      const idx = i
      obras.push(
        o({
          ...base(),
          etapa,
          valor: comValor(idx) && etapa !== 'pendFat' ? 100000 : null,
          inicio_plan: etapa === 'andamento' && k < 2 ? '2026-10-01' : etapa === 'levantamento' && k === 0 ? '2026-10-14' : null,
          inicio_real: etapa === 'andamento' && k < 2 ? '2026-10-02' : null,
          duracao: etapa === 'andamento' || etapa === 'levantamento' ? 10 : null,
          liberado_em: etapa === 'aprovarOS' ? '2026-09-29' : null,
          marco_liberou_fat: etapa === 'pendFat' ? '2026-10-02' : null,
        })
      )
    }
  // Ajusta para 31 sem valor exatos.
  let sem = obras.filter((x) => x.valor === null).length
  for (const x of obras) {
    if (sem <= 31) break
    if (x.valor === null) {
      x.valor = 40000
      sem--
    }
  }
  obras.push(o({ ...base(), etapa: 'faturado', valor: 180000, marco_faturou: '2026-09-20', marco_liberou_fat: '2026-09-10' }))
  const remarcacoes: LinhaRemarcacao[] = obras
    .filter((x) => x.etapa === 'andamento')
    .slice(0, 2)
    .map((x) => ({ obra_id: x.id, data: '2026-10-03', de: '2026-10-01', para: '2026-10-03', created_at: '2026-10-03T10:00:00Z' }))
  return { obras, diario: [], tarefas: [], remarcacoes, hoje: HOJE }
}

export const painelDiaNormal = (): Painel => montarPainel(entradaDiaNormal(), FILTRO)
export const painelQuaseVazio = (): Painel => montarPainel(entradaQuaseVazio(), FILTRO)

/** Dia normal com a carteira em 8 dígitos (`R$ 12.345.678`) — spec §5.6. */
export function painelValorGrande(): Painel {
  const p = painelDiaNormal()
  return { ...p, kpis: { ...p.kpis, carteira: { ...p.kpis.carteira, valor: 12345678 }, faturamentoMes: { ...p.kpis.faturamentoMes, valor: 12345678 } } }
}
