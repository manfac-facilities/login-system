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
})

test('identificacao: valor invalido nao vai ao servidor', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn()
  render(
    <BlocoIdentificacao
      obraId="o1"
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
})

test('cronograma: mudar inicio abre a janela; duracao nao', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
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
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ duracao: '25', motivo: '' }))
})

test('cronograma: apagar o inicio tambem pede motivo', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
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
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ inicio: '', motivo: 'Clima' }))
})

test('cronograma: equipe aceita texto livre, com sugestões das equipes já usadas', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(
    <BlocoCronograma
      obraId="o1"
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
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ equipe: 'GRUPO SERTAO MANUTENCAO' }))
}, 20000)

// Obra cancelada: os três blocos só leitura (spec do cancelamento §6.5).
function renderBloco(titulo: string, extra: { somenteLeitura?: boolean }) {
  const salvar = jest.fn()
  if (titulo === 'Autorização') {
    return render(
      <BlocoAutorizacao
        obraId="o1"
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
