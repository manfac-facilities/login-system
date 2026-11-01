import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({ salvarPessoaAction: jest.fn(), removerPessoaAction: jest.fn(), moverPessoaAction: jest.fn() }))
jest.mock('../../configuracoes/_actions', () => ({ salvarDestinatarioAction: jest.fn(async () => ({ ok: true })) }))
jest.mock('../../configuracoes/_actions-portal', () => ({
  adicionarAcessoAction: jest.fn(async () => ({ ok: true })),
  alternarAcessoAction: jest.fn(async () => ({ ok: true })),
  removerAcessoAction: jest.fn(async () => ({ ok: true })),
}))

import Organograma from '../_organograma'
import { adicionarAcessoAction, alternarAcessoAction, removerAcessoAction } from '../../configuracoes/_actions-portal'
import { foraDoOrganograma, type Pessoa } from '../../../_lib/organograma'
import type { Destinatario } from '../../configuracoes/_tipos'
import type { AcessoPortal } from '../../configuracoes/_tipos-portal'

const ana: Pessoa = { id: 'p1', nome: 'Ana', cargo: 'Coord.', email: 'ana@dpsp.com.br', ordem: 0 }
const eng: Pessoa = { id: 'p2', nome: 'Eng', cargo: null, email: 'eng@manfac.com.br', ordem: 1 }

function montar(pessoas: Pessoa[], destinatarios: Destinatario[] = [], acessos: AcessoPortal[] = []) {
  return render(
    <Organograma obraId="o1" admin pessoas={pessoas} chips={{ destinatarios, acessos }} fora={foraDoOrganograma(pessoas, destinatarios, acessos)} erroChips={false} />,
  )
}
const grupo = (email: string) => screen.getByRole('group', { name: `Envios e portal de ${email}` })

beforeEach(() => jest.clearAllMocks())

describe('chip Portal (actions das Configurações)', () => {
  it('sem acesso: liga criando o acesso com e-mail e nome', async () => {
    montar([ana])
    fireEvent.click(within(grupo('ana@dpsp.com.br')).getByRole('button', { name: 'Portal' }))
    await waitFor(() => expect(adicionarAcessoAction).toHaveBeenCalledWith('o1', { email: 'ana@dpsp.com.br', nome: 'Ana' }))
    expect(alternarAcessoAction).not.toHaveBeenCalled()
  })
  it('com acesso ativo: desliga pela mesma linha (alternar para false)', async () => {
    montar([ana], [], [{ id: 'a1', email: 'ana@dpsp.com.br', nome: 'Ana', ativo: true }])
    const portal = within(grupo('ana@dpsp.com.br')).getByRole('button', { name: 'Portal' })
    expect(portal).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(portal)
    await waitFor(() => expect(alternarAcessoAction).toHaveBeenCalledWith('o1', 'a1', false))
    expect(adicionarAcessoAction).not.toHaveBeenCalled()
  })
  it('com acesso desativado: religa a mesma linha', async () => {
    montar([ana], [], [{ id: 'a1', email: 'ana@dpsp.com.br', nome: 'Ana', ativo: false }])
    fireEvent.click(within(grupo('ana@dpsp.com.br')).getByRole('button', { name: 'Portal' }))
    await waitFor(() => expect(alternarAcessoAction).toHaveBeenCalledWith('o1', 'a1', true))
  })
})

describe('e-mail da Manfac e funções da lista antiga', () => {
  it('pessoa @manfac.com.br não tem chips, só o aviso', () => {
    montar([eng])
    expect(screen.queryByRole('group', { name: 'Envios e portal de eng@manfac.com.br' })).toBeNull()
    expect(screen.getByText(/E-mail da Manfac: não é do cliente/)).toBeInTheDocument()
  })
  it('"sem cadastro": remover acesso ao portal e editar o destinatário do cliente', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    const d: Destinatario = { id: 'd1', email: 'bia@dpsp.com.br', nome: 'Bia', funcao: 'Gerente', lado: 'cliente', tipos: ['diario'], ativo: true }
    montar([ana], [d], [{ id: 'a2', email: 'bia@dpsp.com.br', nome: 'Bia', ativo: true }])
    const fora = screen.getByRole('region', { name: 'Sem cadastro no organograma' })
    fireEvent.click(within(fora).getByRole('button', { name: 'Remover acesso' }))
    await waitFor(() => expect(removerAcessoAction).toHaveBeenCalledWith('o1', 'a2'))
    fireEvent.click(within(fora).getByRole('button', { name: 'Editar envio' }))
    expect(within(fora).getByLabelText('Função')).toHaveValue('Gerente')
  })
})
