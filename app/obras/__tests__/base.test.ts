/**
 * Testes das regras da Base de obras (`app/obras/base/_regras.ts`).
 *
 * Nada é mockado: são funções puras sobre `Obra[]`. `hoje` é sempre passado
 * explicitamente para `derivar` — 2026-08-31, o HOJE do mockup — para o teste
 * não depender do relógio da máquina.
 *
 * O que estes testes protegem, e por quê:
 *  - **KPI nunca olha o filtro.** É a regra do mockup que mais fácil se perde
 *    numa refatoração, e quando se perde o painel zera e dá a impressão de que
 *    a operação parou.
 *  - Os cinco recortes do filtro "Autorização", que é onde mora o estado de
 *    risco que hoje ninguém enxerga (sem cobertura).
 *  - Vazio no fim da ordenação, nos dois sentidos.
 */

import { derivar, type Etapa, type ObraRow } from '../_lib/tipos'
import {
  COLS,
  FILTROS_PADRAO,
  ORDEM_PADRAO,
  alternarOrdem,
  filtrar,
  kpisDaBase,
  opcoesEtapa,
  ordenar,
  responsaveisDaBase,
  sufixoDias,
} from '../base/_regras'

const HOJE = '2026-08-31'

function linha(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: Math.random().toString(36).slice(2),
    os: '0226-000001',
    loja: 'DP TESTE',
    descricao: null,
    tipo: 'TELHADO',
    valor: null,
    origem: 'Sistema DPSP',
    fonte: null,
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento' as Etapa,
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: '2026-08-20',
    inicio_plan: '2026-08-21',
    inicio_real: null,
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
    atualizacao: '2026-08-30',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

const obra = (over: Partial<ObraRow> = {}) => derivar(linha(over), HOJE)

describe('filtrar — Responsável da obra', () => {
  const base = [obra({ pcm: 'YURI' }), obra({ pcm: 'AMANDA' }), obra({ pcm: null })]

  it('devolve tudo em "Todos"', () => {
    expect(filtrar(base, FILTROS_PADRAO)).toHaveLength(3)
  })

  it('filtra por um responsável', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, pcm: 'YURI' })).toHaveLength(1)
  })

  it('"Ainda sem responsável" pega só quem não tem ninguém', () => {
    const r = filtrar(base, { ...FILTROS_PADRAO, pcm: '__sem' })
    expect(r).toHaveLength(1)
    expect(r[0].pcm).toBeNull()
  })
})

describe('filtrar — Etapa da obra', () => {
  const base = [
    obra({ etapa: 'definir' }),
    obra({ etapa: 'andamento' }),
    obra({ etapa: 'fecharOS', desde_etapa: '2026-08-01' }),
    obra({ etapa: 'faturado', desde_etapa: '2026-08-01' }),
  ]

  it('filtra por etapa exata', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, etapa: 'andamento' })).toHaveLength(1)
  })

  it('filtra por fase inteira', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, etapa: 'fase:antes' })).toHaveLength(1)
  })

  it('"Executadas, ainda na esteira" exclui a obra já faturada', () => {
    const r = filtrar(base, { ...FILTROS_PADRAO, etapa: '__esteira' })
    expect(r).toHaveLength(1)
    expect(r[0].etapa).toBe('fecharOS')
  })

  it('as opções vêm agrupadas pelas quatro fases, com a esteira em destaque', () => {
    const o = opcoesEtapa()
    expect(o.soltas.map((x) => x.t)).toEqual(['Todas', 'Executadas, ainda na esteira'])
    expect(o.grupos.map((g) => g.fase)).toEqual([
      'Antes de executar',
      'Executando',
      'Fechamento',
      'Faturamento',
    ])
  })
})

describe('filtrar — Autorização', () => {
  const comOS = obra({ os_aprovada: true })
  const semOS = obra({ os_aprovada: false, liberado_por: 'LEANDRO', liberado_em: '2026-08-10' })
  const semCob = obra({ os_aprovada: false, liberado_por: null })
  const base = [comOS, semOS, semCob]

  it('"Com OS aprovada"', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, os: 'sim' })).toEqual([comOS])
  })

  it('"Sem OS aprovada" traz as duas sem OS, liberada ou não', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, os: 'nao' })).toHaveLength(2)
  })

  it('"Liberadas, ainda sem OS" traz só quem tem nome e não tem documento', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, os: 'liberada' })).toEqual([semOS])
  })

  it('"Sem cobertura" traz só quem não tem nem uma coisa nem outra', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, os: 'semcob' })).toEqual([semCob])
  })

  it('obra aguardando definição nunca conta como sem cobertura — ninguém foi a campo', () => {
    const nova = obra({ etapa: 'definir', os_aprovada: false, liberado_por: null })
    expect(filtrar([nova], { ...FILTROS_PADRAO, os: 'semcob' })).toHaveLength(0)
  })
})

describe('filtrar — Classificação', () => {
  const base = [obra({ mau_uso: true }), obra({ mau_uso: false })]

  it('"Só mau uso" e "Sem mau uso" são complementares', () => {
    expect(filtrar(base, { ...FILTROS_PADRAO, mau: 'sim' })).toHaveLength(1)
    expect(filtrar(base, { ...FILTROS_PADRAO, mau: 'nao' })).toHaveLength(1)
  })

  it('mau uso não tira a obra do funil: ela continua na etapa em que está', () => {
    const m = obra({ mau_uso: true, etapa: 'fecharOS', desde_etapa: '2026-08-01' })
    expect(filtrar([m], { ...FILTROS_PADRAO, etapa: 'fecharOS' })).toHaveLength(1)
  })
})

describe('filtrar — Field Control', () => {
  const presente = obra({ field_ausente_em: null })
  const ausente = obra({
    field_ausente_desde: '2026-08-29T12:00:00Z',
    field_ausente_em: '2026-08-30T12:00:00Z',
  })

  it('o padrão conserva todas as obras visíveis', () => {
    expect(filtrar([presente, ausente], FILTROS_PADRAO)).toHaveLength(2)
  })

  it('coluna ainda ausente no deploy chega como undefined e não cria alerta falso', () => {
    const semColuna = obra({ field_ausente_em: undefined as unknown as null })

    expect(filtrar([semColuna], { ...FILTROS_PADRAO, field: 'ausentes' })).toHaveLength(0)
  })

  it('permite ver somente as obras com alerta confirmado', () => {
    expect(filtrar([presente, ausente], { ...FILTROS_PADRAO, field: 'ausentes' })).toEqual([
      ausente,
    ])
  })
})

describe('kpisDaBase', () => {
  const base = [
    obra({ etapa: 'definir', aprovacao: '2026-06-01', os_aprovada: false }),
    obra({ etapa: 'andamento' }),
    obra({ etapa: 'paralisado' }),
    obra({ etapa: 'fecharOS', desde_etapa: '2026-08-01', os_aprovada: false, liberado_por: null }),
  ]

  it('devolve os oito indicadores do mockup, na ordem aprovada', () => {
    const k = kpisDaBase(base)
    expect(k).toHaveLength(8)
    expect(k[1].rotulo).toBe('em andamento')
    expect(k[2].rotulo).toBe('paralisadas')
    expect(k[4].rotulo).toBe('sem OS aprovada no cliente')
    expect(k[5].rotulo).toBe('sem cobertura — nem OS nem liberação')
    expect(k[6].rotulo).toBe('aprovadas há mais de 60 dias')
    expect(k[7].rotulo).toBe('passaram da duração planejada')
  })

  it('conta aguardando definição com a idade da mais antiga', () => {
    const k = kpisDaBase(base)
    expect(k[0].valor).toBe(1)
    expect(k[0].rotulo).toBe('aguardando definição · a mais antiga há 91 dias')
  })

  it('não escreve idade quando não há obra aguardando definição', () => {
    const k = kpisDaBase([obra({ etapa: 'andamento' })])
    expect(k[0].rotulo).toBe('aguardando definição')
  })

  it('conta a esteira com a mais parada', () => {
    const k = kpisDaBase(base)
    expect(k[3].valor).toBe(1)
    expect(k[3].rotulo).toBe('executadas, ainda na esteira · a mais parada há 30 dias')
  })

  it('OS INTEIRA, NUNCA O FILTRO: o KPI não muda quando a lista é filtrada', () => {
    const filtrada = filtrar(base, { ...FILTROS_PADRAO, etapa: 'andamento' })
    expect(filtrada).toHaveLength(1)
    // A tela chama kpisDaBase(todas) — nunca kpisDaBase(filtrada). Este teste
    // existe para que a diferença fique visível se alguém trocar o argumento.
    expect(kpisDaBase(base)[1].valor).toBe(1)
    expect(kpisDaBase(base)[2].valor).toBe(1)
    expect(kpisDaBase(filtrada)[2].valor).toBe(0)
  })
})

describe('ordenar', () => {
  it('o default é a contagem de alerta decrescente', () => {
    expect(ORDEM_PADRAO).toEqual({ col: 'diasAlerta', dir: -1 })
    // A entrada é candidata sempre (decisão do João de 15/09), então sem
    // fixar created_at ela venceria como âncora em pelo menos uma das obras e
    // confundiria este teste, que quer só verificar a ordenação.
    // Correção (review M7): '2026-08-30T00:00:00Z' vira 2026-08-29 em São
    // Paulo — EMPATA com a aprovação do primeiro item (2026-08-29), não fica
    // depois dela. Quem decide o empate é a prioridade aprovação > entrada
    // (a mesma de sempre), não a ordem das datas; o resultado é o mesmo.
    const entradaTardia = { created_at: '2026-08-30T00:00:00Z' }
    const base = [
      obra({ aprovacao: '2026-08-29', ...entradaTardia }),
      obra({ aprovacao: '2026-06-01', ...entradaTardia }),
      obra({ aprovacao: '2026-08-15', ...entradaTardia }),
    ]
    expect(ordenar(base, ORDEM_PADRAO).map((o) => o.diasAlerta)).toEqual([91, 16, 2])
  })

  it('ordena pela âncora, não pela aprovação', () => {
    const liberadaAntes = obra({
      aprovacao: '2026-08-29',
      liberado_por: 'JUAN',
      liberado_em: '2026-06-01',
    })
    const soAprovada = obra({ aprovacao: '2026-08-15' })
    expect(ordenar([soAprovada, liberadaAntes], ORDEM_PADRAO)).toEqual([liberadaAntes, soAprovada])
  })

  it('vazio vai para o fim nos dois sentidos', () => {
    const base = [obra({ pcm: null }), obra({ pcm: 'AMANDA' }), obra({ pcm: 'YURI' })]
    expect(ordenar(base, { col: 'pcm', dir: 1 }).map((o) => o.pcm)).toEqual([
      'AMANDA',
      'YURI',
      null,
    ])
    expect(ordenar(base, { col: 'pcm', dir: -1 }).map((o) => o.pcm)).toEqual([
      'YURI',
      'AMANDA',
      null,
    ])
  })

  it('ordena texto em pt-BR, não por código de caractere', () => {
    const base = [obra({ loja: 'DP ÁGUA' }), obra({ loja: 'DP BAIRRO' }), obra({ loja: 'DP ABC' })]
    expect(ordenar(base, { col: 'loja', dir: 1 }).map((o) => o.loja)).toEqual([
      'DP ABC',
      'DP ÁGUA',
      'DP BAIRRO',
    ])
  })

  it('ordena a etapa pelo nome que aparece na tela, não pela chave interna', () => {
    const base = [obra({ etapa: 'andamento' }), obra({ etapa: 'definir' })]
    // "Aguardando definição" < "Em andamento" — pela chave seria o contrário.
    expect(ordenar(base, { col: 'etapa', dir: 1 }).map((o) => o.etapa)).toEqual([
      'definir',
      'andamento',
    ])
  })

  it('ordena o número da OS numericamente, não por texto — 985 antes de 10024', () => {
    const base = [obra({ os: '10024' }), obra({ os: '985' }), obra({ os: '200' })]
    expect(ordenar(base, { col: 'os', dir: 1 }).map((o) => o.os)).toEqual(['200', '985', '10024'])
    expect(ordenar(base, { col: 'os', dir: -1 }).map((o) => o.os)).toEqual(['10024', '985', '200'])
  })

  it('ordena os três formatos de OS de produção (dígito puro, prefixo, texto livre) numa ordem total e estável', () => {
    // Comparar como número só quando os DOIS lados são puramente dígitos (a
    // versão anterior) não é transitivo quando um dos lados é texto — a
    // ordem podia depender de quem era comparado com quem. `localeCompare`
    // com `numeric: true` usa o mesmo algoritmo (UCA) nos três formatos, então
    // dá uma ordem total consistente qualquer que seja a ordem de entrada.
    const os = [
      '0926-009923',
      'DP CATETE 10 - PINTURA HUB',
      '106',
      '0126-013004',
      'VISA141',
      '2755523',
      'DP CATETE 5 - PINTURA HUB',
      '54',
    ]
    const esperado = [
      '54',
      '106',
      '0126-013004',
      '0926-009923',
      '2755523',
      'DP CATETE 5 - PINTURA HUB',
      'DP CATETE 10 - PINTURA HUB',
      'VISA141',
    ]
    const base = os.map((v) => obra({ os: v }))
    const embaralhada = [...base].reverse()
    expect(ordenar(base, { col: 'os', dir: 1 }).map((o) => o.os)).toEqual(esperado)
    // Mesmo resultado partindo de uma entrada em outra ordem — confirma que é
    // uma ordem total, não um artefato da ordem de chegada.
    expect(ordenar(embaralhada, { col: 'os', dir: 1 }).map((o) => o.os)).toEqual(esperado)
  })

  it('OS ausente continua indo para o fim, mesmo com os outros formatos misturados', () => {
    const base = [obra({ os: '0226-014989' }), obra({ os: '985' }), obra({ os: null })]
    const r = ordenar(base, { col: 'os', dir: 1 })
    expect(r.map((o) => o.os)).toEqual(['0226-014989', '985', null])
  })
})

describe('alternarOrdem', () => {
  it('mesma coluna inverte o sentido', () => {
    expect(alternarOrdem({ col: 'dias', dir: -1 }, 'dias')).toEqual({ col: 'dias', dir: 1 })
  })

  it('coluna nova começa descendente', () => {
    expect(alternarOrdem({ col: 'dias', dir: 1 }, 'loja')).toEqual({ col: 'loja', dir: -1 })
  })
})

describe('colunas e responsáveis', () => {
  it('a tabela mostra a prioridade — decisão técnica 5 da spec', () => {
    expect(COLS.map((c) => c.t)).toContain('Prioridade')
  })

  it('os rótulos das colunas são os aprovados no mockup', () => {
    expect(COLS.map((c) => c.t)).toEqual([
      'Nº OS',
      'Loja',
      'Tipo',
      'Responsável',
      'Equipe / prestador',
      'Etapa da obra',
      'Prioridade',
      'Com quem está',
      'Parada nesta etapa',
      'OS do cliente',
      'Bloqueio',
      'Dias em aberto',
      'Prazo consumido',
      'Última atualização',
    ])
  })

  it('a lista de responsáveis não repete nem inclui vazio', () => {
    const base = [obra({ pcm: 'YURI' }), obra({ pcm: 'YURI' }), obra({ pcm: null })]
    expect(responsaveisDaBase(base)).toEqual(['YURI'])
  })
})

describe('sufixoDias — o selo diz de onde está contando', () => {
  it('forma longa nomeia a âncora', () => {
    expect(sufixoDias({ diasAlerta: 104, ancora: { de: 'liberacao', data: '2026-06-02' } })).toBe(
      'dias desde a liberação'
    )
    expect(sufixoDias({ diasAlerta: 109, ancora: { de: 'aprovacao', data: '2026-05-28' } })).toBe(
      'dias desde a aprovação'
    )
    expect(sufixoDias({ diasAlerta: 75, ancora: { de: 'entrada', data: '2026-07-01' } })).toBe(
      'dias desde a entrada'
    )
  })

  it('singular com 1 dia', () => {
    expect(sufixoDias({ diasAlerta: 1, ancora: { de: 'entrada', data: '2026-08-30' } })).toBe(
      'dia desde a entrada'
    )
  })

  it('forma curta e obra sem âncora dizem só a unidade', () => {
    expect(
      sufixoDias({ diasAlerta: 104, ancora: { de: 'liberacao', data: '2026-06-02' } }, true)
    ).toBe('dias')
    expect(sufixoDias({ diasAlerta: null, ancora: null })).toBe('dias')
  })
})
