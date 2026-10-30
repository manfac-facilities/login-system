/**
 * Cartão e topo do Diário com obras agendadas — spec 16/10/2026 §4.1 e §4.3.
 */

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('../_actions', () => ({
  salvarDiarioAction: jest.fn(),
  desfazerDiarioAction: jest.fn(),
  obterUrlFotoAction: jest.fn(),
  agendarDiarioAction: jest.fn(),
  encerrarAgendamentoAction: jest.fn(),
}))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cartoes from '../_cartoes'
import { encerrarAgendamentoAction } from '../_actions'
import { derivar, type ObraRow } from '../../_lib/tipos'

const HOJE = '2026-10-15'
const PESSOAS = [{ email: 'yuri.moreira@manfac.com.br', nome: 'Yuri Moreira' }]

function obra(id: string, over: Partial<ObraRow> = {}) {
  const row = {
    id,
    os: `OS${id}`,
    loja: `Loja ${id}`,
    cliente: null,
    descricao: 'Troca de piso',
    tipo: 'Reforma',
    valor: null,
    origem: null,
    fonte: null,
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
    pcm: 'YURI',
    equipe: 'EQ1',
    os_aprovada: false,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: null,
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
    created_at: '2026-10-10T12:00:00Z',
    updated_at: null,
    ...over,
  } as ObraRow
  return derivar(row, HOJE)
}

const agendamento = (ate: string): Partial<ObraRow> => ({
  diario_agendado_ate: ate,
  diario_agendado_oque: 'Levantamento de material',
  diario_agendado_motivo: 'Aguardando material',
  diario_agendado_por: 'yuri.moreira@manfac.com.br',
  diario_agendado_em: '2026-10-14T15:00:00Z',
})

function montar(
  obras: ReturnType<typeof obra>[],
  agendadas: ReturnType<typeof obra>[] = [],
  over: Partial<React.ComponentProps<typeof Cartoes>> = {}
) {
  return render(
    <Cartoes
      obras={obras}
      agendadas={agendadas}
      pessoasPorEmail={PESSOAS}
      respostas={{}}
      tarefas={{}}
      pessoas={{}}
      hoje={HOJE}
      admin={false}
      responsaveis={[]}
      analistaSelecionado=""
      minhaChave="YURI"
      {...over}
    />
  )
}

beforeEach(() => jest.clearAllMocks())

test('cartão tem o botão Agendar e a nota; clicar abre o diálogo', async () => {
  const user = userEvent.setup()
  montar([obra('1')])
  expect(
    screen.getByText('Para obra que só será levantada mais tarde: ela sai do diário até a data que você escolher.')
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Agendar e tirar do diário/ }))
  expect(screen.getByRole('dialog', { name: 'Agendar e tirar do diário' })).toBeInTheDocument()
})

test('faixa "Voltou do agendamento": hoje e data passada', () => {
  montar([obra('1', agendamento('2026-10-15')), obra('2', agendamento('2026-10-14'))])
  expect(
    screen.getByText(
      'Voltou do agendamento: levantamento de material previsto para hoje. Agendado por Yuri · motivo: Aguardando material'
    )
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'Voltou do agendamento: levantamento de material previsto para 14/10. Agendado por Yuri · motivo: Aguardando material'
    )
  ).toBeInTheDocument()
})

test('barra com agendadas: abre o bloco e "Trazer de volta agora" chama a action', async () => {
  const user = userEvent.setup()
  ;(encerrarAgendamentoAction as jest.Mock).mockResolvedValue({ success: true })
  montar([obra('1'), obra('2')], [obra('3', agendamento('2026-10-22'))])
  expect(screen.getByText('obras para responder hoje')).toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: /1 agendada/ })
  await user.click(toggle)
  expect(screen.getByText('Agendadas — fora do diário até a data')).toBeInTheDocument()
  expect(screen.getByText('volta em 22/10')).toBeInTheDocument()
  expect(screen.getByText('Motivo: Aguardando material · agendou Yuri em 14/10')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Trazer de volta agora' }))
  expect(encerrarAgendamentoAction).toHaveBeenCalledWith('3', 'volta')
  expect(await screen.findByText('Loja 3 voltou para o diário.')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalled()
})

test('com 0 agendadas a barra mostra "· 0 agendadas" e o bloco aberto mostra o vazio', async () => {
  const user = userEvent.setup()
  montar([obra('1')])
  await user.click(screen.getByRole('button', { name: /0 agendadas/ }))
  expect(
    screen.getByText(
      'Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece aqui.'
    )
  ).toBeInTheDocument()
})

test('fila vazia e 2 agendadas: "Todas as obras deste diário estão agendadas"', () => {
  montar([], [obra('3', agendamento('2026-10-22')), obra('4', agendamento('2026-10-23'))])
  expect(screen.getByText('Nenhuma obra para responder hoje')).toBeInTheDocument()
  expect(
    screen.getByText('Todas as obras deste diário estão agendadas. Elas voltam sozinhas nas datas marcadas.')
  ).toBeInTheDocument()
})

test('diário fechado com 1 agendada avisa que ela não conta', () => {
  const o = obra('1')
  montar([o], [obra('3', agendamento('2026-10-22'))], {
    respostas: { 1: { obra_id: '1', andou: true, motivo: null, item: 'Não faltou', obs: null, foto_path: 'x' } } as never,
  })
  expect(screen.getByText(/1 agendada não conta até a data de volta/)).toBeInTheDocument()
})

test('a obra que voltou vem antes de uma com mais dias em aberto', () => {
  montar([
    obra('velha', { created_at: '2026-08-01T12:00:00Z' }),
    obra('voltou', { ...agendamento('2026-10-15'), created_at: '2026-10-10T12:00:00Z' }),
  ])
  const cartoes = screen.getAllByRole('article')
  expect(within(cartoes[0]).getByText('Loja voltou')).toBeInTheDocument()
  expect(within(cartoes[1]).getByText('Loja velha')).toBeInTheDocument()
})

test('admin vê o texto novo do seletor', () => {
  montar([obra('1')], [], { admin: true, responsaveis: ['YURI'] })
  expect(
    screen.getByText('Você é administrador do hub: vê tudo e pode trazer de volta qualquer agendada.')
  ).toBeInTheDocument()
})

// ---- diário liberado para todos (spec 27/10/2026 §4) ----
const NOTA_TODOS =
  'Você vê as obras de todos os responsáveis e pode responder no lugar deles. Fica registrado quem respondeu.'
const respondida = (id: string, autoria: unknown) =>
  ({ [id]: { obra_id: id, andou: true, motivo: null, item: 'Não faltou', obs: null, foto_path: 'x', autoria } }) as never

test('não-admin vê o seletor, com "Todos os responsáveis" = ?analista=todos, e a nota nova', () => {
  montar([obra('1')], [], { responsaveis: ['AMANDA', 'YURI'], analistaSelecionado: 'YURI' })
  const sel = screen.getByLabelText('Diário de quem') as HTMLSelectElement
  expect(sel.value).toBe('YURI')
  expect(within(sel).getByRole('option', { name: 'Todos os responsáveis' })).toHaveAttribute('value', 'todos')
  expect(screen.getByText(NOTA_TODOS)).toBeInTheDocument()
})

test('sem filtro o seletor marca "Todos os responsáveis" e o cartão mostra o responsável', () => {
  montar([obra('1')], [], { responsaveis: ['YURI'], minhaChave: 'MARCOS' })
  expect((screen.getByLabelText('Diário de quem') as HTMLSelectElement).value).toBe('todos')
  expect(screen.getByText('Responsável')).toBeInTheDocument()
})

test('quem não é pcm da obra nem admin não vê "Agendar"', () => {
  montar([obra('1')], [], { minhaChave: 'MARCOS' })
  expect(screen.queryByRole('button', { name: /Agendar e tirar do diário/ })).toBeNull()
})

test('quem não é pcm nem admin não vê "Trazer de volta agora"', async () => {
  const user = userEvent.setup()
  montar([obra('1')], [obra('3', agendamento('2026-10-22'))], { minhaChave: 'MARCOS' })
  await user.click(screen.getByRole('button', { name: /1 agendada/ }))
  expect(screen.getByText('volta em 22/10')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trazer de volta agora' })).toBeNull()
})

test('admin vê "Agendar" em obra de outro responsável', () => {
  montar([obra('1')], [], { admin: true, minhaChave: 'ADMIN' })
  expect(screen.getByRole('button', { name: /Agendar e tirar do diário/ })).toBeInTheDocument()
})

test('rótulo de autoria: em nome de', () => {
  montar([obra('1')], [], { respostas: respondida('1', { por: 'Marcos', emNomeDe: 'Yuri', hora: '10:02' }) })
  expect(screen.getByText((_, el) => el?.textContent === 'Respondido por Marcos em nome de Yuri às 10:02')).toBeInTheDocument()
  expect(screen.getByText('Yuri')).toHaveClass('text-[#f05a28]')
})

test('rótulo de autoria: o próprio responsável', () => {
  montar([obra('1')], [], { respostas: respondida('1', { por: 'Yuri', emNomeDe: null, hora: '09:14' }) })
  expect(screen.getByText((_, el) => el?.textContent === 'Respondido por Yuri às 09:14')).toBeInTheDocument()
})

test('resposta antiga, sem autoria: sem rótulo', () => {
  montar([obra('1')], [], { respostas: respondida('1', null) })
  expect(screen.queryByText(/Respondido por/)).toBeNull()
})
