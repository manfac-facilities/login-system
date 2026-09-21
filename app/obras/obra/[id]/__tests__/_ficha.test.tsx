/**
 * Testes de composição da Ficha (`../_ficha.tsx`).
 *
 * Diferente de `_blocos-editaveis.test.tsx` (testa cada bloco isolado), este
 * arquivo renderiza a `<Ficha>` inteira — é o único jeito de testar a
 * ligação do histórico (item 1 da revisão de 20/09), que só aparece no
 * encaixe entre `page.tsx` e `_ficha.tsx`, não em cada peça isolada.
 *
 * Padrão de fixture de `app/obras/__tests__/tipos.test.ts` (`obraRow` +
 * `derivar`): a Ficha só aceita `Obra`, o tipo já derivado.
 */

import { render, screen, within } from '@testing-library/react'

// `_ficha.tsx` importa as Server Actions de verdade de `./_actions` (R17 do
// header do arquivo: "as actions entram nos blocos por prop", e é esta tela
// que faz a ligação). Sem mocks aqui, `_actions.ts` puxa `next/cache`, que
// puxa internals do servidor Next que pedem `TextEncoder` — ausente no
// ambiente jsdom do Jest. Mesmo padrão de `app/obras/__tests__/ficha.test.ts`.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import Ficha from '../_ficha'
import { derivar, type ObraRow } from '../../../_lib/tipos'
import type { LinhaHistorico } from '../../../_lib/historico'

const HOJE = '2026-09-21'

function obraRow(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0226-014989',
    loja: 'DP BAIRRO DE FATIMA',
    descricao: 'Forro do estoque caiu',
    tipo: 'TELHADO',
    valor: 28520.46,
    origem: 'Sistema DPSP',
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: 'LEANDRO',
    liberado_em: '2026-08-20',
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: 'Normal',
    aprovacao: '2026-04-30',
    inicio_plan: '2026-08-19',
    inicio_real: '2026-08-19',
    duracao: 7,
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
    atualizacao: '2026-08-20',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

/** As props mínimas de `<Ficha>` — os blocos vazios (`[]`/`{}`) bastam para o
 * que este arquivo confere: a ligação do bloco de histórico. */
function fichaProps(overObra: Partial<ObraRow> = {}, historico: LinhaHistorico[] = []) {
  return {
    obra: derivar(obraRow(overObra), HOJE),
    diario: [],
    remarcacoes: [],
    tarefas: [],
    pessoas: {},
    fotos: {},
    responsaveis: [],
    equipes: [],
    analistasCliente: [],
    motivos: [],
    hoje: HOJE,
    historico,
  }
}

describe('Histórico de alterações (item 1 da revisão de 20/09)', () => {
  it('a ficha renderiza o bloco de histórico com as linhas recebidas por prop', () => {
    const linhas: LinhaHistorico[] = [
      {
        id: 'h1',
        obra_id: 'o1',
        bloco: 'Cronograma',
        campo: 'prioridade',
        de: 'Normal',
        para: 'Urgente',
        motivo: null,
        quem: 'yuri@manfac.com.br',
        created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Ficha {...fichaProps({}, linhas)} />)
    const titulo = screen.getByText('Histórico de alterações')
    expect(titulo).toBeInTheDocument()
    // Escopado à seção do histórico: "Prioridade" e "Normal" também aparecem
    // no bloco Cronograma (rótulo do campo e valor atual da obra).
    const secao = titulo.closest('section') as HTMLElement
    expect(within(secao).getByText(/Prioridade/)).toBeInTheDocument()
    expect(within(secao).getByText('Urgente', { selector: 'b' })).toBeInTheDocument()
  })

  it('sem linhas, o bloco de histórico ainda aparece com a linha de entrada', () => {
    render(<Ficha {...fichaProps()} />)
    expect(screen.getByText('Histórico de alterações')).toBeInTheDocument()
    expect(screen.getByText(/nenhuma alteração/i)).toBeInTheDocument()
  })
})
