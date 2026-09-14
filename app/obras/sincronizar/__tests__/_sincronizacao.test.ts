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
  encontrarConsultasDeReabertura,
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
    archived: false,
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
    field_id: 'ord-1',
    field_ausente_desde: null,
    field_ausente_em: null,
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
        field_id: 'ord-1',
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
      {
        os: '0226-014989',
        loja: null,
        descricao: null,
        fonte: 'field',
        field_id: 'ord-1',
        etapa: 'definir',
      },
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

  it('vincula pelo número e grava field_id quando a obra ainda não tem a identidade do Field', () => {
    const plano = planejarSincronizacao(
      [osDoField()],
      [obraNoBanco({ field_id: null, fonte: null, loja: 'DROGARIA SP', descricao: 'Reforma' })],
    )

    expect(plano.atualizar).toEqual([
      {
        id: 'obra-1',
        os: '0226-014989',
        campos: { fonte: 'field', field_id: 'ord-1' },
      },
    ])
  })

  it('corrige o número pelo field_id sem duplicar nem abrir alerta de sumiço', () => {
    const plano = planejarSincronizacao(
      [osDoField({ os: '0226-999999', idField: 'ord-1' })],
      [
        obraNoBanco({
          os: '0226-014989',
          loja: 'DROGARIA SP',
          descricao: 'Reforma',
          field_ausente_desde: '2026-09-10T12:00:00Z',
        }),
      ],
      { varreduraCompleta: true, agora: '2026-09-14T12:00:00Z' },
    )

    expect(plano.inserir).toHaveLength(0)
    expect(plano.reconciliarAusencias).toHaveLength(0)
    expect(plano.atualizar).toEqual([
      {
        id: 'obra-1',
        os: '0226-999999',
        campos: {
          os: '0226-999999',
          field_ausente_desde: null,
          field_ausente_em: null,
        },
      },
    ])
    expect(plano.numerosDeOsAlterados).toEqual([
      {
        obraId: 'obra-1',
        idField: 'ord-1',
        anterior: '0226-014989',
        atual: '0226-999999',
      },
    ])
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
      reconciliarAusencias: [],
      numerosDeOsAlterados: [],
      alertasRemovidos: 0,
      inalteradas: 0,
      ignoradas: [],
      avisos: [],
    })
  })
})

describe('planejarSincronizacao — ausência no Field', () => {
  const AGORA = '2026-09-14T12:00:00Z'

  function umaAusente(over: Partial<ObraExistente> = {}) {
    const ausente = obraNoBanco(over)
    const presentes = Array.from({ length: 5 }, (_, indice) => {
      const n = indice + 2
      return obraNoBanco({
        id: `obra-${n}`,
        os: `OS-${n}`,
        field_id: `ord-${n}`,
        loja: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP',
        descricao: 'Forro do estoque caiu',
      })
    })
    const doField = presentes.map((obra) =>
      osDoField({ os: obra.os as string, idField: obra.field_id as string }),
    )
    return { doField, existentes: [ausente, ...presentes] }
  }

  it('a primeira varredura completa ausente cria só uma suspeita', () => {
    const cenario = umaAusente()
    const plano = planejarSincronizacao(cenario.doField, cenario.existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toEqual([
      {
        id: 'obra-1',
        os: '0226-014989',
        idField: 'ord-1',
        acao: 'suspeita',
        campos: { field_ausente_desde: AGORA },
      },
    ])
  })

  it('confirma o alerta com a tolerância de 20 horas para a cadência diária', () => {
    const cenario = umaAusente({ field_ausente_desde: '2026-09-13T16:00:00Z' })
    const plano = planejarSincronizacao(cenario.doField, cenario.existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias[0]).toMatchObject({
      acao: 'alerta',
      campos: { field_ausente_em: AGORA },
    })
  })

  it('não confirma a suspeita antes da tolerância de 20 horas', () => {
    const cenario = umaAusente({ field_ausente_desde: '2026-09-14T11:59:59Z' })
    const plano = planejarSincronizacao(cenario.doField, cenario.existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toHaveLength(0)
  })

  it('não marca ausência quando a varredura completa devolve zero OS', () => {
    const plano = planejarSincronizacao([], [obraNoBanco()], {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toHaveLength(0)
    expect(plano.avisos[0]).toMatch(/0 OS/i)
  })

  it('não marca ausência em massa acima do maior valor entre 3 e 20%', () => {
    const existentes = Array.from({ length: 10 }, (_, indice) =>
      obraNoBanco({
        id: `obra-${indice}`,
        os: `OS-${indice}`,
        field_id: `ord-${indice}`,
      }),
    )
    const doField = existentes.slice(0, 6).map((obra) =>
      osDoField({ os: obra.os as string, idField: obra.field_id as string }),
    )
    const plano = planejarSincronizacao(doField, existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toHaveLength(0)
    expect(plano.avisos[0]).toMatch(/limite de segurança/i)
  })

  it('alertas antigos não entram no disjuntor e não bloqueiam uma ausência nova', () => {
    const existentes = Array.from({ length: 10 }, (_, indice) =>
      obraNoBanco({
        id: `obra-${indice}`,
        os: `OS-${indice}`,
        field_id: `ord-${indice}`,
        field_ausente_desde: indice >= 6 && indice <= 8 ? '2026-09-12T12:00:00Z' : null,
        field_ausente_em: indice >= 6 && indice <= 8 ? '2026-09-13T12:00:00Z' : null,
      }),
    )
    const doField = existentes.slice(0, 6).map((obra) =>
      osDoField({ os: obra.os as string, idField: obra.field_id as string }),
    )
    const plano = planejarSincronizacao(doField, existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.avisos).toHaveLength(0)
    expect(plano.reconciliarAusencias).toEqual([
      {
        id: 'obra-9',
        os: 'OS-9',
        idField: 'ord-9',
        acao: 'suspeita',
        campos: { field_ausente_desde: AGORA },
      },
    ])
  })

  it('o piso absoluto permite uma ausência isolada numa base pequena', () => {
    const existentes = [
      obraNoBanco(),
      obraNoBanco({ id: 'obra-2', os: 'OS-2', field_id: 'ord-2' }),
      obraNoBanco({ id: 'obra-3', os: 'OS-3', field_id: 'ord-3' }),
    ]
    const doField = existentes.slice(1).map((obra) =>
      osDoField({ os: obra.os as string, idField: obra.field_id as string }),
    )

    const plano = planejarSincronizacao(doField, existentes, {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.avisos).toHaveLength(0)
    expect(plano.reconciliarAusencias).toHaveLength(1)
  })

  it('base e Field vazios são um estado válido, sem aviso inútil', () => {
    const plano = planejarSincronizacao([], [], { varreduraCompleta: true, agora: AGORA })

    expect(plano.avisos).toHaveLength(0)
  })

  it('varredura incremental nunca infere ausência', () => {
    const plano = planejarSincronizacao([], [obraNoBanco()], {
      varreduraCompleta: false,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toHaveLength(0)
  })

  it('obra de procedência desconhecida nunca é marcada', () => {
    const plano = planejarSincronizacao([], [obraNoBanco({ fonte: null })], {
      varreduraCompleta: true,
      agora: AGORA,
    })

    expect(plano.reconciliarAusencias).toHaveLength(0)
  })

  it('reaparecer limpa suspeita e alerta automaticamente', () => {
    const plano = planejarSincronizacao(
      [osDoField()],
      [
        obraNoBanco({
          loja: 'DROGARIA SP',
          descricao: 'Reforma',
          field_ausente_desde: '2026-09-12T12:00:00Z',
          field_ausente_em: '2026-09-13T12:00:00Z',
        }),
      ],
      { varreduraCompleta: false, agora: AGORA },
    )

    expect(plano.atualizar).toEqual([
      {
        id: 'obra-1',
        os: '0226-014989',
        campos: { field_ausente_desde: null, field_ausente_em: null },
        removeAlerta: true,
      },
    ])
    expect(plano.alertasRemovidos).toBe(1)
  })
})

describe('planejarSincronizacao — OS reaberta com o mesmo número', () => {
  const antiga = obraNoBanco({
    loja: 'DROGARIA SP',
    descricao: 'Reforma',
    field_id: 'ord-antiga',
    field_ausente_desde: '2026-09-12T12:00:00Z',
    field_ausente_em: '2026-09-13T12:00:00Z',
  })
  const reaberta = osDoField({ idField: 'ord-nova' })

  it('identifica a consulta necessária antes de decidir a herança', () => {
    expect(encontrarConsultasDeReabertura([reaberta], [antiga])).toEqual([
      {
        os: '0226-014989',
        idFieldAnterior: 'ord-antiga',
        idFieldAtual: 'ord-nova',
      },
    ])
  })

  it('herda o histórico somente quando a ordem antiga está arquivada', () => {
      const plano = planejarSincronizacao([reaberta], [antiga], {
        verificacoesDeReabertura: [
          {
            os: '0226-014989',
            idFieldAnterior: 'ord-antiga',
            idFieldAtual: 'ord-nova',
            situacao: 'arquivada',
          },
        ],
      })

      expect(plano.inserir).toHaveLength(0)
      expect(plano.atualizar).toEqual([
        {
          id: 'obra-1',
          os: '0226-014989',
          campos: {
            field_id: 'ord-nova',
            field_ausente_desde: null,
            field_ausente_em: null,
          },
          removeAlerta: true,
          historicoHerdado: {
            obraId: 'obra-1',
            os: '0226-014989',
            idFieldAnterior: 'ord-antiga',
            idFieldAtual: 'ord-nova',
          },
        },
      ])
      expect(plano.ignoradas).toHaveLength(0)
  })

  it('não herda quando a ordem antiga ainda está ativa', () => {
    const plano = planejarSincronizacao([reaberta], [antiga], {
      verificacoesDeReabertura: [
        {
          os: '0226-014989',
          idFieldAnterior: 'ord-antiga',
          idFieldAtual: 'ord-nova',
          situacao: 'ativa',
        },
      ],
    })

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas[0].motivo).toMatch(/ainda está ativa/i)
  })

  it('não herda quando a consulta é inconclusiva e deixa nova tentativa explícita', () => {
    const plano = planejarSincronizacao([reaberta], [antiga], {
      verificacoesDeReabertura: [
        {
          os: '0226-014989',
          idFieldAnterior: 'ord-antiga',
          idFieldAtual: 'ord-nova',
          situacao: 'inconclusiva',
          tratamento: 'tentar_novamente',
        },
      ],
    })

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas[0].motivo).toMatch(/tentaremos na próxima execução/i)
  })

  it('leva resposta inconclusiva permanente ao relatório como decisão manual', () => {
    const plano = planejarSincronizacao([reaberta], [antiga], {
      verificacoesDeReabertura: [
        {
          os: '0226-014989',
          idFieldAnterior: 'ord-antiga',
          idFieldAtual: 'ord-nova',
          situacao: 'inconclusiva',
          tratamento: 'decisao_manual',
          motivo: 'Field Control respondeu 422',
        },
      ],
    })

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas[0].motivo).toMatch(/precisa de decisão manual/i)
    expect(plano.ignoradas[0].motivo).toMatch(/Field Control respondeu 422/i)
  })

  it('herda sem consulta quando a antiga vem arquivada na mesma varredura e não cria obra híbrida', () => {
    const antigaRenumerada = osDoField({
      os: 'OS-300',
      idField: 'ord-antiga',
      archived: true,
    })

    expect(encontrarConsultasDeReabertura([antigaRenumerada, reaberta], [antiga])).toEqual([])

    const plano = planejarSincronizacao([antigaRenumerada, reaberta], [antiga])

    expect(plano.atualizar).toHaveLength(1)
    expect(plano.atualizar[0].campos).toEqual({
      field_id: 'ord-nova',
      field_ausente_desde: null,
      field_ausente_em: null,
    })
    expect(plano.numerosDeOsAlterados).toHaveLength(0)
    expect(plano.atualizar[0].historicoHerdado).toBeDefined()
  })

  it('não consulta nem herda quando a antiga vem ativa na mesma varredura', () => {
    const antigaRenumerada = osDoField({
      os: 'OS-300',
      idField: 'ord-antiga',
      archived: false,
    })

    expect(encontrarConsultasDeReabertura([antigaRenumerada, reaberta], [antiga])).toEqual([])

    const plano = planejarSincronizacao([antigaRenumerada, reaberta], [antiga])

    expect(plano.atualizar).toHaveLength(1)
    expect(plano.atualizar[0]).toMatchObject({
      id: 'obra-1',
      campos: { os: 'OS-300' },
    })
    expect(plano.atualizar[0].historicoHerdado).toBeUndefined()
    expect(plano.ignoradas.some((item) => /ainda está ativa/i.test(item.motivo))).toBe(true)
  })

  it('OS arquivada na listagem não conta como presente ativa nem limpa alerta', () => {
    const plano = planejarSincronizacao(
      [osDoField({ idField: 'ord-antiga', archived: true })],
      [antiga],
      { varreduraCompleta: false },
    )

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.alertasRemovidos).toBe(0)
    expect(plano.inalteradas).toBe(0)
  })

  it('troca de números entre duas obras continua como conflito', () => {
    const outra = obraNoBanco({ id: 'obra-2', os: 'OS-2', field_id: 'ord-2' })
    const plano = planejarSincronizacao(
      [osDoField({ idField: 'ord-antiga', os: 'OS-2' })],
      [antiga, outra],
    )

    expect(plano.atualizar).toHaveLength(0)
    expect(plano.ignoradas[0].motivo).toMatch(/apontam para obras diferentes/i)
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
