/**
 * Testes de composição da Ficha (`../_ficha.tsx`).
 *
 * Diferente de `_blocos-editaveis.test.tsx` (testa cada bloco isolado),
 * este arquivo renderiza a `<Ficha>` inteira — é o único jeito de testar
 * como os pedaços se encaixam: a esteira (item 7 da revisão de 20/09) e a
 * ligação do histórico (item 1) só aparecem no encaixe, não em cada peça.
 *
 * Padrão de fixture de `app/obras/__tests__/tipos.test.ts` (`obraRow` +
 * `derivar`): a Ficha só aceita `Obra`, o tipo já derivado.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
 * que este arquivo confere: a esteira e o bloco de histórico. */
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

describe('Esteira — selo "a obra está aqui" (item 7 da revisão de 20/09)', () => {
  // As duas obras destes testes já saíram de campo (`marco_exec_fim`
  // preenchido): isola a contagem no PASSO ZERO ("Execução em campo", que é
  // 'atual' sempre que `marco_exec_fim` falta, fora do laço de `ESTEIRA`) do
  // que o laço de `ESTEIRA` (relatório → aprovarOS → fecharOS → pendFat →
  // faturado) decide sozinho.
  const POS_CAMPO = { marco_exec_fim: '2026-08-24', marco_relatorio: '2026-08-25' }

  it('etapa parada em aprovarOS com OS já aprovada ainda marca ESSE passo como atual', () => {
    // Combinação que disparava o bug: `_etapa.tsx` troca a etapa livremente
    // (sem trava por papel), então uma obra pode ficar PARADA em `aprovarOS`
    // com `os_aprovada = true` mas `marco_os_aprov` ainda não preenchido (o
    // satélite não sincronizou — R7 espera os três juntos, mas nada no banco
    // IMPEDE o descompasso). Antes do fix, isso caía sempre no ramo do
    // desvio "pulado" e NENHUM passo da esteira recebia o selo.
    render(
      <Ficha
        {...fichaProps({
          ...POS_CAMPO,
          etapa: 'aprovarOS',
          os_aprovada: true,
          aprovacao: '2026-08-20',
          marco_os_aprov: null,
        })}
      />
    )
    expect(screen.getAllByText('a obra está aqui')).toHaveLength(1)
  })

  it('etapa parada em aprovarOS com marco_os_aprov JÁ preenchido continua marcada como atual', () => {
    // Bug da revisão independente de 21/09: `estado` calculava `data ?
    // 'feito' : etapa === k ? 'atual' : 'futuro'` — se o marco do passo em
    // que a obra ESTÁ já tem data (o satélite marco_os_aprov sincronizou
    // antes da troca de etapa, ou foi preenchido por outro caminho), o passo
    // vira 'feito' e nenhum recebe o selo "a obra está aqui". A etapa atual
    // tem que ganhar prioridade sobre o marco preenchido.
    render(
      <Ficha
        {...fichaProps({
          ...POS_CAMPO,
          etapa: 'aprovarOS',
          os_aprovada: true,
          aprovacao: '2026-08-20',
          marco_os_aprov: '2026-08-21',
        })}
      />
    )
    expect(screen.getAllByText('a obra está aqui')).toHaveLength(1)
  })

  it('o desvio "Executado - pendente aprovação OS" continua desenhado, apagado, quando a etapa já passou dele', () => {
    // Regressão: o caminho ORIGINAL do desvio (obra que pulou aprovarOS de
    // verdade, porque a OS já estava aprovada antes do relatório) continua
    // funcionando depois do fix.
    render(
      <Ficha
        {...fichaProps({
          ...POS_CAMPO,
          etapa: 'fecharOS',
          os_aprovada: true,
          aprovacao: '2026-08-20',
          marco_os_aprov: '2026-08-20',
        })}
      />
    )
    expect(screen.getByText(/Desvio não usado/)).toBeInTheDocument()
    expect(screen.getAllByText('a obra está aqui')).toHaveLength(1)
  })
})

describe('Nome do desvio e "Fechar OS sempre existe" (ajuste 1, 23/09)', () => {
  const POS_CAMPO = { marco_exec_fim: '2026-08-24', marco_relatorio: '2026-08-25' }
  const DIRETO = {
    ...POS_CAMPO,
    etapa: 'fecharOS' as const,
    os_aprovada: true,
    aprovacao: '2026-08-20',
    marco_os_aprov: '2026-08-20',
  }

  it('o nome antigo "Pendente fechamento" não aparece em lugar nenhum da ficha', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'aprovarOS' })} />)
    expect(screen.queryByText(/Pendente fechamento/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Executado - pendente aprovação OS/).length).toBeGreaterThan(0)
  })
  it('caminho direto: o desvio pulado usa o nome novo', () => {
    render(<Ficha {...fichaProps(DIRETO)} />)
    expect(screen.getByText(/Desvio não usado/)).toBeInTheDocument()
    expect(screen.queryByText(/Pendente fechamento/)).not.toBeInTheDocument()
  })
  it('"Fechar OS" leva o selo "sempre existe" nos dois caminhos', () => {
    const { unmount } = render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'aprovarOS' })} />)
    expect(screen.getByText('sempre existe')).toBeInTheDocument()
    unmount()
    render(<Ficha {...fichaProps(DIRETO)} />)
    expect(screen.getByText('sempre existe')).toBeInTheDocument()
  })
  it('caminho direto parado em Fechar OS explica que o passo nunca é pulado', () => {
    render(<Ficha {...fichaProps(DIRETO)} />)
    expect(screen.getByText(/nunca é pulado/)).toBeInTheDocument()
  })
})

describe('Data de fechamento da OS na ficha (ajuste 2, 23/09)', () => {
  const POS_CAMPO = { marco_exec_fim: '2026-08-24', marco_relatorio: '2026-08-25' }

  it('Fechar OS concluído mostra a data e "corrigir data"', () => {
    render(
      <Ficha
        {...fichaProps({
          ...POS_CAMPO,
          etapa: 'pendFat',
          marco_relatorio: '2026-09-15',
          marco_fechou_os: '2026-09-19',
        })}
      />
    )
    expect(screen.getByText(/Fechada no sistema do cliente em/)).toHaveTextContent('19/09/2026')
    expect(screen.getByRole('button', { name: 'corrigir data' })).toBeInTheDocument()
  })
  it('Fechar OS atual ou futuro não oferece "corrigir data"', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS' })} />)
    expect(screen.queryByRole('button', { name: 'corrigir data' })).not.toBeInTheDocument()
  })
  it('o seletor de etapa recebe hoje e a referência (campo aparece em Fechar OS → Pendente faturamento)', async () => {
    const u = userEvent.setup()
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS' })} />)
    await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
    expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue(HOJE)
  }, 20000)
})
