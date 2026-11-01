import { destinatarioAposChip, estadoChips, foraDoOrganograma, reordenar, type Pessoa } from '../organograma'
import type { Destinatario } from '../../[id]/configuracoes/_tipos'

const ana = { nome: 'Ana', cargo: 'Coordenadora', email: 'ana@dpsp.com.br' }
const dest = (over: Partial<Destinatario> = {}): Destinatario => ({
  id: 'd1', email: 'ana@dpsp.com.br', nome: 'Ana C.', funcao: 'Coord.', lado: 'cliente', tipos: ['diario', 'imediato'], ativo: true, ...over,
})
const pessoa = (id: string, ordem: number, email: string | null = null): Pessoa => ({ id, nome: id, cargo: null, email, ordem })

describe('estadoChips', () => {
  it('lê das duas tabelas pelo e-mail (sem diferenciar maiúsculas); inativo apaga', () => {
    const e = estadoChips('ANA@dpsp.com.br', [dest()], [{ id: 'a1', email: 'ana@dpsp.com.br', nome: null, ativo: true }])
    expect(e.portal).toBe(true)
    expect(e.envio).toEqual({ diario: true, semanal: false, mensal: false, imediato: true })
    const i = estadoChips('ana@dpsp.com.br', [dest({ ativo: false })], [{ id: 'a1', email: 'ana@dpsp.com.br', nome: null, ativo: false }])
    expect(i.portal).toBe(false)
    expect(i.envio.diario).toBe(false)
  })
})

describe('destinatarioAposChip (grava pela action das Configurações)', () => {
  it('sem linha: cria do lado cliente só com o tipo', () => {
    expect(destinatarioAposChip(ana, null, 'semanal', true)).toEqual({
      email: 'ana@dpsp.com.br', nome: 'Ana', funcao: 'Coordenadora', lado: 'cliente', tipos: ['semanal'], ativo: true,
    })
    expect(destinatarioAposChip(ana, null, 'semanal', false)).toBeNull()
  })
  it('com linha: liga/desliga só o tipo, preserva id, nome, função, lado e os outros tipos', () => {
    expect(destinatarioAposChip(ana, dest(), 'mensal', true)).toEqual({ ...dest(), tipos: ['diario', 'imediato', 'mensal'] })
    expect(destinatarioAposChip(ana, dest(), 'diario', false)).toEqual({ ...dest(), tipos: ['imediato'] })
  })
  it('desligar o último tipo desativa (tipos ficam: a action exige ao menos um)', () => {
    expect(destinatarioAposChip(ana, dest({ tipos: ['diario'] }), 'diario', false)).toEqual({ ...dest({ tipos: ['diario'] }), ativo: false })
  })
  it('linha inativa: ligar um tipo reativa só com ele', () => {
    expect(destinatarioAposChip(ana, dest({ ativo: false }), 'semanal', true)).toEqual({ ...dest(), tipos: ['semanal'], ativo: true })
  })
})

describe('foraDoOrganograma', () => {
  it('mostra destinatário do cliente e acesso ao portal sem pessoa; interno e quem está no organograma ficam de fora', () => {
    const f = foraDoOrganograma(
      [pessoa('p1', 0, 'ana@dpsp.com.br')],
      [dest(), dest({ id: 'd2', email: 'bia@dpsp.com.br', nome: 'Bia' }), dest({ id: 'd3', email: 'eng@manfac.com.br', lado: 'interno' })],
      [{ id: 'a1', email: 'bia@dpsp.com.br', nome: null, ativo: true }, { id: 'a2', email: 'caio@dpsp.com.br', nome: 'Caio', ativo: false }],
    )
    expect(f.map((x) => [x.email, x.destinatario?.id ?? null, x.acesso?.id ?? null])).toEqual([
      ['bia@dpsp.com.br', 'd2', 'a1'],
      ['caio@dpsp.com.br', null, 'a2'],
    ])
  })
})

describe('reordenar', () => {
  const lista = [pessoa('a', 0), pessoa('b', 1), pessoa('c', 2)]
  it('troca com o vizinho e devolve só quem muda', () => {
    expect(reordenar(lista, 'c', 'cima')).toEqual([{ id: 'c', ordem: 1 }, { id: 'b', ordem: 2 }])
    expect(reordenar(lista, 'a', 'cima')).toEqual([])
    expect(reordenar(lista, 'c', 'baixo')).toEqual([])
  })
  it('normaliza ordens repetidas', () => {
    expect(reordenar([pessoa('a', 0), pessoa('b', 0)], 'a', 'baixo')).toEqual([{ id: 'a', ordem: 1 }])
  })
})

describe('e-mail da Manfac (fix 1)', () => {
  it('nunca vira destinatário do lado cliente', () => {
    expect(destinatarioAposChip({ nome: 'Eng', cargo: null, email: 'eng@manfac.com.br' }, null, 'diario', true)?.lado).toBe('interno')
  })
})
