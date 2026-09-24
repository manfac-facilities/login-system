import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlocoAutorizacao from '../_bloco-autorizacao'
import BlocoIdentificacao from '../_bloco-identificacao'
import BlocoCronograma from '../_bloco-cronograma'

// 20s de limite, não os 5s padrão: este teste faz três interações com userEvent,
// e com a suíte inteira em paralelo nesta máquina elas não cabem em 5s. Medido em
// 18/09/2026: --runInBand sempre passou, em paralelo estourava o tempo do TESTE
// (não o da consulta). O componente nunca esteve errado.
test('autorizacao: editar, erro do servidor, cancelar', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ error: 'Erro ao salvar a autorização' })
  render(
    <BlocoAutorizacao
      obraId="o1"
      versao="v1"
      valores={{ origem: '', libPor: '', libEm: '', aprovadaEm: '' }}
      analistas={['LEANDRO']}
      hoje="2026-09-18"
      diasSemOS={12}
      etapa="aprovarOS"
      responsavel="LUANA"
      rodape={<span>Sem edição</span>}
      salvar={salvar}
    />
  )
  expect(screen.getByText('Ninguém liberou esta obra')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Editar Autorização' }))
  await u.selectOptions(screen.getByLabelText('Liberado por'), 'LEANDRO')
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(await screen.findByText(/Não salvou a autorização/)).toBeInTheDocument()
  expect(screen.getByLabelText('Liberado por')).toHaveValue('LEANDRO')
  await u.click(screen.getByRole('button', { name: 'Cancelar' }))
  // findByRole, não getByRole: a saída do modo edição é assíncrona.
  const editar = await screen.findByRole('button', { name: 'Editar Autorização' })
  await waitFor(() => expect(editar).toHaveFocus())
}, 20000)

test('autorizacao: aprovacao em aprovarOS abre a janela de avanço', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true, avancou: true })
  render(
    <BlocoAutorizacao
      obraId="o1"
      versao="v1"
      valores={{ origem: '', libPor: 'LEANDRO', libEm: '2026-08-20', aprovadaEm: '' }}
      analistas={['LEANDRO']}
      hoje="2026-09-18"
      diasSemOS={12}
      etapa="aprovarOS"
      responsavel="LUANA"
      rodape={null}
      salvar={salvar}
    />
  )
  await u.click(screen.getByRole('button', { name: 'Editar Autorização' }))
  const d = screen.getByLabelText('OS aprovada em')
  await u.type(d, '2026-09-10')
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Salvar a aprovação e avançar a obra')
  await u.click(screen.getByRole('button', { name: 'Salvar e avançar para Fechar OS' }))
  expect(salvar).toHaveBeenCalled()
}, 20000)

test('identificacao: valor invalido nao vai ao servidor', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn()
  render(
    <BlocoIdentificacao
      obraId="o1"
      versao="v1"
      valores={{ tipo: 'CIVIL', valor: '18.450,00', analista: '', mauUso: false }}
      campoDoField={{ os: '0826-1', loja: 'LOJA', chamado: 'Piso' }}
      analistas={['LEANDRO']}
      rodape={null}
      salvar={salvar}
    />
  )
  await u.click(screen.getByRole('button', { name: 'Editar Identificação' }))
  const v = screen.getByLabelText('Valor (R$)')
  await u.clear(v)
  await u.type(v, 'abc')
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(salvar).not.toHaveBeenCalled()
  expect(screen.getByText(/Valor precisa ser um número/)).toBeInTheDocument()
  expect(v).toHaveFocus()
}, 20000)

test('cronograma: mudar inicio abre a janela; duracao nao', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
      versao="v1"
      valores={{ resp: 'LUANA', equipe: 'MANFAC-7', prioridade: 'Normal', inicio: '2026-08-24', duracao: '20' }}
      responsaveis={['LUANA']}
      equipes={['MANFAC-7']}
      motivos={['Clima', 'Outro']}
      rodape={null}
      salvar={salvar}
    />
  )
  await u.click(screen.getByRole('button', { name: 'Editar Cronograma' }))
  const dur = screen.getByLabelText('Duração em dias')
  await u.clear(dur)
  await u.type(dur, '25')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ duracao: '25', motivo: '' }), 'v1')
}, 20000)

test('cronograma: apagar o inicio tambem pede motivo', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
      versao="v1"
      valores={{ resp: '', equipe: '', prioridade: '', inicio: '2026-08-24', duracao: '20' }}
      responsaveis={['LUANA']}
      equipes={['MANFAC-7']}
      motivos={['Clima', 'Outro']}
      rodape={null}
      salvar={salvar}
    />
  )
  await u.click(screen.getByRole('button', { name: 'Editar Cronograma' }))
  await u.clear(screen.getByLabelText('Início planejado'))
  expect(screen.getByText('Mudar o início é uma remarcação')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Remarcar o início da obra')
  await u.click(screen.getByRole('radio', { name: 'Clima' }))
  await u.click(screen.getByRole('button', { name: 'Remarcar e salvar' }))
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ inicio: '', motivo: 'Clima' }), 'v1')
}, 20000)

test('cronograma: equipe aceita texto livre, com sugestões das equipes já usadas', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
      versao="v1"
      valores={{ resp: 'LUANA', equipe: 'MANFAC-7', prioridade: 'Normal', inicio: '2026-08-24', duracao: '20' }}
      responsaveis={['LUANA']}
      equipes={['ALEX', 'MANFAC-7']}
      motivos={['Clima', 'Outro']}
      rodape={null}
      salvar={salvar}
    />
  )
  await u.click(screen.getByRole('button', { name: 'Editar Cronograma' }))
  const campo = screen.getByLabelText('Equipe / prestador')
  expect(campo).toHaveAttribute('type', 'text')
  const lista = document.getElementById(campo.getAttribute('list')!)!
  expect(lista.querySelectorAll('option')).toHaveLength(2)
  await u.clear(campo)
  await u.type(campo, 'GRUPO SERTAO MANUTENCAO')
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ equipe: 'GRUPO SERTAO MANUTENCAO' }), 'v1')
}, 20000)

// Obra cancelada: os três blocos só leitura (spec do cancelamento §6.5).
function renderBloco(titulo: string, extra: { somenteLeitura?: boolean }) {
  const salvar = jest.fn()
  if (titulo === 'Autorização') {
    return render(
      <BlocoAutorizacao
        obraId="o1"
        versao="v1"
        valores={{ origem: '', libPor: 'LEANDRO', libEm: '2026-08-20', aprovadaEm: '' }}
        analistas={['LEANDRO']}
        hoje="2026-09-18"
        diasSemOS={12}
        etapa="cancelado"
        responsavel="LUANA"
        rodape={null}
        salvar={salvar}
        {...extra}
      />
    )
  }
  if (titulo === 'Identificação') {
    return render(
      <BlocoIdentificacao
        obraId="o1"
        versao="v1"
        valores={{ tipo: 'CIVIL', valor: '18.450,00', analista: '', mauUso: false }}
        campoDoField={{ os: '0826-1', loja: 'LOJA', chamado: 'Piso' }}
        analistas={['LEANDRO']}
        rodape={null}
        salvar={salvar}
        {...extra}
      />
    )
  }
  return render(
    <BlocoCronograma
      obraId="o1"
      versao="v1"
      valores={{ resp: 'LUANA', equipe: 'MANFAC-7', prioridade: 'Normal', inicio: '2026-08-24', duracao: '20' }}
      responsaveis={['LUANA']}
      equipes={['MANFAC-7']}
      motivos={['Clima', 'Outro']}
      rodape={null}
      salvar={salvar}
      {...extra}
    />
  )
}

test.each(['Autorização', 'Identificação', 'Cronograma'])(
  '%s com somenteLeitura: mostra os valores e não tem Editar',
  (titulo) => {
    renderBloco(titulo, { somenteLeitura: true })
    expect(screen.getByText(titulo)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Editar ${titulo}` })).not.toBeInTheDocument()
  }
)

test('sem a prop, o Editar continua lá (comportamento de hoje)', () => {
  renderBloco('Cronograma', {})
  expect(screen.getByRole('button', { name: 'Editar Cronograma' })).toBeInTheDocument()
})

// ============================================================
// A1 — cada bloco captura a versão no Editar e a devolve ao salvar
// (spec-dividas-ficha-2026-09-23 §5.3, passos 1–2)
// ============================================================

const CONFLITO =
  'Outra pessoa alterou esta obra enquanto você editava. Recarregue a página para ver o que foi gravado e refaça a sua alteração.'

type Salvar = jest.Mock

function bloco(titulo: string, versao: string, salvar: Salvar) {
  if (titulo === 'Autorização') {
    return (
      <BlocoAutorizacao
        obraId="o1"
        versao={versao}
        valores={{ origem: '', libPor: '', libEm: '', aprovadaEm: '' }}
        analistas={['LEANDRO']}
        hoje="2026-09-18"
        diasSemOS={null}
        etapa="andamento"
        responsavel="LUANA"
        rodape={null}
        salvar={salvar}
      />
    )
  }
  if (titulo === 'Identificação') {
    return (
      <BlocoIdentificacao
        obraId="o1"
        versao={versao}
        valores={{ tipo: 'CIVIL', valor: '18.450,00', analista: '', mauUso: false }}
        campoDoField={{ os: '0826-1', loja: 'LOJA', chamado: 'Piso' }}
        analistas={['LEANDRO']}
        rodape={null}
        salvar={salvar}
      />
    )
  }
  return (
    <BlocoCronograma
      obraId="o1"
      versao={versao}
      valores={{ resp: 'LUANA', equipe: 'MANFAC-7', prioridade: 'Normal', inicio: '2026-08-24', duracao: '20' }}
      responsaveis={['LUANA']}
      equipes={['MANFAC-7']}
      motivos={['Clima', 'Outro']}
      rodape={null}
      salvar={salvar}
    />
  )
}

/** Muda um campo do bloco que não abre janela nenhuma. */
async function mudarUmCampo(u: ReturnType<typeof userEvent.setup>, titulo: string) {
  if (titulo === 'Autorização') {
    await u.selectOptions(screen.getByLabelText('Liberado por'), 'LEANDRO')
  } else if (titulo === 'Identificação') {
    await u.click(screen.getByLabelText('Mau uso'))
  } else {
    const dur = screen.getByLabelText('Duração em dias')
    await u.clear(dur)
    await u.type(dur, '25')
  }
}

const TITULOS = ['Autorização', 'Identificação', 'Cronograma']

test.each(TITULOS)(
  '%s: salvar manda a versão lida no Editar',
  async (titulo) => {
    const u = userEvent.setup()
    const salvar = jest.fn().mockResolvedValue({ success: true })
    render(bloco(titulo, 'v1', salvar))
    await u.click(screen.getByRole('button', { name: `Editar ${titulo}` }))
    await mudarUmCampo(u, titulo)
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalledWith('o1', expect.any(Object), 'v1')
  },
  20000
)

test.each(TITULOS)(
  '%s: página revalidada durante a edição não troca a versão capturada',
  async (titulo) => {
    const u = userEvent.setup()
    const salvar = jest.fn().mockResolvedValue({ success: true })
    const { rerender } = render(bloco(titulo, 'v1', salvar))
    await u.click(screen.getByRole('button', { name: `Editar ${titulo}` }))
    await mudarUmCampo(u, titulo)
    rerender(bloco(titulo, 'v2', salvar))
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalledWith('o1', expect.any(Object), 'v1')
  },
  20000
)

test.each(TITULOS)(
  '%s: Cancelar e Editar de novo captura a versão nova',
  async (titulo) => {
    const u = userEvent.setup()
    const salvar = jest.fn().mockResolvedValue({ success: true })
    const { rerender } = render(bloco(titulo, 'v1', salvar))
    await u.click(screen.getByRole('button', { name: `Editar ${titulo}` }))
    await u.click(screen.getByRole('button', { name: 'Cancelar' }))
    rerender(bloco(titulo, 'v2', salvar))
    await u.click(await screen.findByRole('button', { name: `Editar ${titulo}` }, { timeout: 5000 }))
    await mudarUmCampo(u, titulo)
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalledWith('o1', expect.any(Object), 'v2')
  },
  20000
)

test.each(TITULOS)(
  '%s: conflito devolvido pelo servidor aparece na caixa e o bloco continua em edição',
  async (titulo) => {
    const u = userEvent.setup()
    const salvar = jest.fn().mockResolvedValue({ error: CONFLITO })
    render(bloco(titulo, 'v1', salvar))
    await u.click(screen.getByRole('button', { name: `Editar ${titulo}` }))
    await mudarUmCampo(u, titulo)
    await u.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(CONFLITO, { exact: false }, { timeout: 5000 })).toBeInTheDocument()
    // findByRole: o "Salvando…" volta a "Salvar" quando a transição termina.
    expect(await screen.findByRole('button', { name: 'Salvar' }, { timeout: 5000 })).toBeInTheDocument()
  },
  20000
)

test('cronograma: o caminho da janela de remarcação também manda a versão capturada', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  const { rerender } = render(bloco('Cronograma', 'v1', salvar))
  await u.click(screen.getByRole('button', { name: 'Editar Cronograma' }))
  const inicio = screen.getByLabelText('Início planejado')
  await u.clear(inicio)
  await u.type(inicio, '2026-08-30')
  rerender(bloco('Cronograma', 'v2', salvar))
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  await u.click(screen.getByRole('radio', { name: 'Clima' }))
  await u.click(screen.getByRole('button', { name: 'Remarcar e salvar' }))
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ motivo: 'Clima' }), 'v1')
}, 20000)
