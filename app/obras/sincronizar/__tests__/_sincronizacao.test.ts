/**
 * Testes da decisão de sincronização — a parte que não toca rede nem banco.
 *
 * O que está sob teste aqui é a REGRA DE RECARGA: o que o Field pode escrever
 * numa obra que já existe. A regra é uma só e é do João: só preenche o que está
 * vazio. O que alguém digitou no hub nunca é sobrescrito.
 */

import type { OsNormalizada } from '../../_lib/field'
import {
  emLotes,
  numerosDeOsDoField,
  planejarSincronizacao,
  type ObraExistente,
} from '../_sincronizacao'

function osDoField(over: Partial<OsNormalizada> = {}): OsNormalizada {
  return {
    os: '0226-014989',
    descricao: 'Forro do estoque caiu',
    loja: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP',
    idField: 'ord-1',
    atualizadoEm: '2026-09-11T12:00:00Z',
    ...over,
  }
}

function obraNoBanco(over: Partial<ObraExistente> = {}): ObraExistente {
  return {
    id: 'obra-1',
    os: '0226-014989',
    loja: null,
    descricao: null,
    fonte: 'field',
    ...over,
  }
}

describe('planejarSincronizacao — OS que ainda não existe', () => {
  it('cria a obra com procedência field e etapa "definir"', () => {
    const plano = planejarSincronizacao([osDoField()], [])

    expect(plano.inserir).toEqual([
      {
        os: '0226-014989',
        loja: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP',
        descricao: 'Forro do estoque caiu',
        fonte: 'field',
        etapa: 'definir',
      },
    ])
    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas).toHaveLength(0)
    expect(plano.totalDoField).toBe(1)
  })

  it('cria a obra mesmo quando o Field não sabe loja nem descrição', () => {
    const plano = planejarSincronizacao([osDoField({ loja: null, descricao: null })], [])

    expect(plano.inserir).toEqual([
      { os: '0226-014989', loja: null, descricao: null, fonte: 'field', etapa: 'definir' },
    ])
  })
})

describe('planejarSincronizacao — OS que já existe', () => {
  it('NÃO sobrescreve campo que já tem valor no banco', () => {
    const plano = planejarSincronizacao(
      [osDoField({ loja: 'ENDEREÇO NOVO VINDO DO FIELD', descricao: 'texto novo do Field' })],
      [obraNoBanco({ loja: 'DROGARIA SP - SANTO AMARO', descricao: 'Reforma da fachada' })],
    )

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.inserir).toHaveLength(0)
    expect(plano.inalteradas).toBe(1)
  })

  it('preenche só o campo que está vazio, deixando o preenchido intacto', () => {
    const plano = planejarSincronizacao(
      [osDoField({ loja: 'ENDEREÇO NOVO VINDO DO FIELD', descricao: 'texto novo do Field' })],
      [obraNoBanco({ loja: 'DROGARIA SP - SANTO AMARO', descricao: null })],
    )

    expect(plano.atualizar).toEqual([
      { id: 'obra-1', os: '0226-014989', campos: { descricao: 'texto novo do Field' } },
    ])
    expect(plano.inalteradas).toBe(0)
  })

  it('carimba como field a obra existente cuja procedência ainda é desconhecida', () => {
    const plano = planejarSincronizacao(
      [osDoField()],
      [obraNoBanco({ loja: 'DROGARIA SP', descricao: 'Reforma', fonte: null })],
    )

    expect(plano.atualizar).toEqual([
      { id: 'obra-1', os: '0226-014989', campos: { fonte: 'field' } },
    ])
    expect(plano.inalteradas).toBe(0)
  })

  it('nunca sobrescreve uma procedência já preenchida', () => {
    const plano = planejarSincronizacao(
      [osDoField()],
      [obraNoBanco({ loja: 'DROGARIA SP', descricao: 'Reforma', fonte: 'field' })],
    )

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.inalteradas).toBe(1)
  })

  it('trata string em branco no banco como campo vazio', () => {
    const plano = planejarSincronizacao(
      [osDoField({ loja: 'Av. Paulista, 1000' })],
      [obraNoBanco({ loja: '   ', descricao: 'já digitado' })],
    )

    expect(plano.atualizar).toEqual([
      { id: 'obra-1', os: '0226-014989', campos: { loja: 'Av. Paulista, 1000' } },
    ])
  })

  it('não atualiza nada quando o Field vem vazio e o banco também', () => {
    const plano = planejarSincronizacao(
      [osDoField({ loja: null, descricao: null })],
      [obraNoBanco()],
    )

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.inalteradas).toBe(1)
  })

  it('nunca mexe na etapa de obra que já existe', () => {
    const plano = planejarSincronizacao(
      [osDoField()],
      [obraNoBanco({ loja: null, descricao: null })],
    )

    expect(plano.atualizar).toHaveLength(1)
    expect(Object.keys(plano.atualizar[0].campos).sort()).toEqual(['descricao', 'loja'])
    expect(plano.atualizar[0].campos).not.toHaveProperty('etapa')
  })
})

describe('planejarSincronizacao — o que fica de fora', () => {
  it.each([null, '', '   '])('ignora OS sem número (%p) com motivo, e não insere', (os) => {
    const plano = planejarSincronizacao(
      [osDoField({ os: os as unknown as string, idField: 'ord-77' })],
      [],
    )

    expect(plano.inserir).toHaveLength(0)
    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas).toHaveLength(1)
    expect(plano.ignoradas[0].idField).toBe('ord-77')
    expect(plano.ignoradas[0].motivo).toMatch(/sem número/i)
  })

  it('ignora a repetição quando o Field devolve o mesmo número duas vezes', () => {
    const plano = planejarSincronizacao(
      [osDoField({ idField: 'ord-1' }), osDoField({ idField: 'ord-2' })],
      [],
    )

    expect(plano.inserir).toHaveLength(1)
    expect(plano.ignoradas).toHaveLength(1)
    expect(plano.ignoradas[0].idField).toBe('ord-2')
    expect(plano.ignoradas[0].motivo).toMatch(/repetid/i)
  })

  it('devolve plano vazio quando o Field não traz nenhuma OS', () => {
    const plano = planejarSincronizacao([], [obraNoBanco()])

    expect(plano).toEqual({
      totalDoField: 0,
      inserir: [],
      atualizar: [],
      inalteradas: 0,
      ignoradas: [],
    })
  })
})

describe('auxiliares de leitura em lote', () => {
  it('junta os números de OS sem repetir e sem os vazios', () => {
    const numeros = numerosDeOsDoField([
      osDoField({ os: 'A' }),
      osDoField({ os: 'A' }),
      osDoField({ os: '  ' }),
      osDoField({ os: 'B' }),
    ])

    expect(numeros).toEqual(['A', 'B'])
  })

  it('quebra a lista em lotes do tamanho pedido', () => {
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(emLotes([], 2)).toEqual([])
  })
})
