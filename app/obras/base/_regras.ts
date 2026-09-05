/**
 * Base de obras — filtro, ordenação, colunas e indicadores.
 *
 * Tudo aqui é FUNÇÃO PURA sobre `Obra[]`: nada de React, nada de Supabase.
 * É o que permite testar a regra sem montar tela (app/obras/__tests__/base.test.ts).
 *
 * As regras de negócio (sev, critico, semCobertura, posCampo…) vêm de
 * `../_lib/tipos` e NÃO são reescritas aqui — este arquivo só as combina.
 *
 * Origem linha a linha: mockup-obras.html `COLS` (:3106), `filtradas` (:3157),
 * `renderBase` (:3175). Os rótulos são os aprovados pelo cliente.
 */

import {
  CICLO,
  ETAPAS,
  encerrada,
  faseDe,
  liberada,
  posCampo,
  semCobertura,
  type Etapa,
  type Fase,
  type Obra,
} from '../_lib/tipos'

/* -------------------------------------------------------------------------- */
/* Cores por etapa                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A cor de cada etapa, como no mockup (`CICLO`, :1157).
 *
 * DÍVIDA CONHECIDA: isto deveria morar em `_ui/primitivos.tsx` ou em
 * `_lib/tipos.ts` (o `EtapaInfo` de lá não tem campo `cor`), que são arquivos
 * da frente A e não podem ser editados por esta frente. Fica local e está
 * reportado — quando a fundação ganhar o campo, apagar daqui.
 */
export const COR_ETAPA: Record<Etapa, string> = {
  definir: '#f05a28', // --accent
  levantamento: '#5aa9f0', // --info
  andamento: '#35c98a', // --ok
  paralisado: '#ff4d6d', // --crit
  relatorio: '#5aa9f0', // --info
  aprovarOS: '#ff4d6d', // --crit
  fecharOS: '#f4b73f', // --warn
  pendFat: '#f4b73f', // --warn
  faturado: '#64748b', // --ink-faint
}

/** A cor de cada fase, para o cabeçalho das colunas do Kanban (`FASES`, :1150). */
export const COR_FASE: Record<Fase, string> = {
  antes: '#5aa9f0',
  campo: '#35c98a',
  fechamento: '#f4b73f',
  faturamento: '#f05a28',
}

/** Cor da pílula de prioridade. Só "Urgente" grita; "Normal" é neutro. */
export const COR_PRIORIDADE: Record<string, string> = {
  Normal: '#94a3b8',
  Urgente: '#f05a28',
}

/* -------------------------------------------------------------------------- */
/* Filtros                                                                    */
/* -------------------------------------------------------------------------- */

/** `todos` | `__sem` (ainda sem responsável) | o nome do responsável. */
export type FiltroPcm = string
/** `todas` | `__esteira` | `fase:<k>` | a chave da etapa. */
export type FiltroEtapa = string
export type FiltroOs = 'todas' | 'sim' | 'nao' | 'liberada' | 'semcob'
export type FiltroMau = 'todas' | 'sim' | 'nao'

export type Filtros = {
  pcm: FiltroPcm
  etapa: FiltroEtapa
  os: FiltroOs
  mau: FiltroMau
}

export const FILTROS_PADRAO: Filtros = { pcm: 'todos', etapa: 'todas', os: 'todas', mau: 'todas' }

/** Rótulos exatos do mockup (:2515-2531). Não reescrever — foram aprovados. */
export const OPCOES_OS: { v: FiltroOs; t: string }[] = [
  { v: 'todas', t: 'Todas' },
  { v: 'sim', t: 'Com OS aprovada' },
  { v: 'nao', t: 'Sem OS aprovada' },
  { v: 'liberada', t: 'Liberadas, ainda sem OS' },
  { v: 'semcob', t: 'Sem cobertura — nem OS nem liberação' },
]

export const OPCOES_MAU: { v: FiltroMau; t: string }[] = [
  { v: 'todas', t: 'Todas' },
  { v: 'sim', t: 'Só mau uso' },
  { v: 'nao', t: 'Sem mau uso' },
]

/**
 * As opções do filtro "Etapa da obra". Segue a ordem do ciclo e agrupa por
 * fase — nove etapas soltas viram lista ilegível. "Executadas, ainda na
 * esteira" vem antes de tudo porque é a pergunta que motivou o projeto.
 */
export type GrupoEtapa = { fase: string; opcoes: { v: string; t: string }[] }

export function opcoesEtapa(): { soltas: { v: string; t: string }[]; grupos: GrupoEtapa[] } {
  const fases: Fase[] = ['antes', 'campo', 'fechamento', 'faturamento']
  const nomes: Record<Fase, string> = {
    antes: 'Antes de executar',
    campo: 'Executando',
    fechamento: 'Fechamento',
    faturamento: 'Faturamento',
  }
  return {
    soltas: [
      { v: 'todas', t: 'Todas' },
      { v: '__esteira', t: 'Executadas, ainda na esteira' },
    ],
    grupos: fases.map((f) => ({
      fase: nomes[f],
      opcoes: [
        { v: `fase:${f}`, t: `Toda a fase ${nomes[f].toLowerCase()}` },
        ...CICLO.filter((c) => c.fase === f).map((c) => ({ v: c.k as string, t: c.nome })),
      ],
    })),
  }
}

/** Os responsáveis que existem de fato na base, em ordem alfabética. */
export function responsaveisDaBase(obras: Pick<Obra, 'pcm'>[]): string[] {
  const vistos = new Set<string>()
  obras.forEach((o) => {
    if (o.pcm) vistos.add(o.pcm)
  })
  return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** `filtradas(mockup:3157)`. Cada filtro é independente dos outros. */
export function filtrar(obras: Obra[], f: Filtros): Obra[] {
  return obras.filter((o) => {
    if (f.pcm === '__sem') {
      if (o.pcm) return false
    } else if (f.pcm !== 'todos' && o.pcm !== f.pcm) {
      return false
    }

    if (f.etapa === '__esteira') {
      if (!posCampo(o) || encerrada(o)) return false
    } else if (f.etapa.startsWith('fase:')) {
      if (faseDe(o) !== f.etapa.slice(5)) return false
    } else if (f.etapa !== 'todas' && o.etapa !== f.etapa) {
      return false
    }

    if (f.os === 'sim' && !o.os_aprovada) return false
    if (f.os === 'nao' && o.os_aprovada) return false
    if (f.os === 'liberada' && !(!o.os_aprovada && liberada(o))) return false
    if (f.os === 'semcob' && !semCobertura(o)) return false

    if (f.mau === 'sim' && !o.mau_uso) return false
    if (f.mau === 'nao' && o.mau_uso) return false

    return true
  })
}

/* -------------------------------------------------------------------------- */
/* Colunas e ordenação                                                        */
/* -------------------------------------------------------------------------- */

export type Coluna = {
  /** A chave em `Obra` pela qual a coluna ordena. */
  k: string
  /** O rótulo do cabeçalho, aprovado no mockup. */
  t: string
  /** Alinhamento numérico à direita. */
  n?: boolean
}

/**
 * `COLS(mockup:3106)`, mais **Prioridade**.
 *
 * A coluna de prioridade é acréscimo desta frente (decisão técnica 5 da spec):
 * o mockup captura o campo na triagem e nunca o exibe. Campo obrigatório que
 * não aparece em lugar nenhum é campo que ninguém entende por que preenche.
 * Ela entra logo depois da etapa, que é a outra coluna de "situação".
 */
export const COLS: Coluna[] = [
  { k: 'os', t: 'Nº OS' },
  { k: 'loja', t: 'Loja' },
  { k: 'tipo', t: 'Tipo' },
  { k: 'pcm', t: 'Responsável' },
  { k: 'equipe', t: 'Equipe / prestador' },
  { k: 'etapa', t: 'Etapa da obra' },
  { k: 'prioridade', t: 'Prioridade' },
  { k: 'dono', t: 'Com quem está' },
  { k: 'paradaEtapa', t: 'Parada nesta etapa', n: true },
  { k: 'os_aprovada', t: 'OS do cliente' },
  { k: 'bloqueio', t: 'Bloqueio' },
  { k: 'dias', t: 'Dias desde a aprovação', n: true },
  { k: 'fracPrazo', t: 'Prazo consumido' },
  { k: 'atualizacao', t: 'Última atualização', n: true },
]

export type Ordem = { col: string; dir: 1 | -1 }

/** O default do mockup: mais dias desde a aprovação primeiro. */
export const ORDEM_PADRAO: Ordem = { col: 'dias', dir: -1 }

/** Clique no cabeçalho: mesma coluna inverte, coluna nova começa descendente. */
export function alternarOrdem(atual: Ordem, col: string): Ordem {
  if (atual.col === col) return { col, dir: atual.dir === 1 ? -1 : 1 }
  return { col, dir: -1 }
}

/**
 * `renderTabela(mockup:3213)`. Vazio vai sempre para o FIM da lista, nos dois
 * sentidos — obra sem responsável não pode encabeçar a ordenação por
 * responsável só porque `null` é menor que qualquer string.
 */
export function ordenar(obras: Obra[], ordem: Ordem): Obra[] {
  const { col, dir } = ordem
  const valor = (o: Obra): unknown => {
    if (col === 'etapa') return ETAPAS[o.etapa]?.nome ?? o.etapa
    return (o as unknown as Record<string, unknown>)[col]
  }
  return obras.slice().sort((a, b) => {
    const x = valor(a)
    const y = valor(b)
    const xVazio = x === null || x === undefined || x === ''
    const yVazio = y === null || y === undefined || y === ''
    if (xVazio && yVazio) return 0
    if (xVazio) return 1
    if (yVazio) return -1
    if (typeof x === 'string' && typeof y === 'string') return dir * x.localeCompare(y, 'pt-BR')
    if (typeof x === 'boolean' && typeof y === 'boolean') return dir * (Number(x) - Number(y))
    return dir * (Number(x) - Number(y))
  })
}

/* -------------------------------------------------------------------------- */
/* Indicadores                                                                */
/* -------------------------------------------------------------------------- */

export type Kpi = { valor: number; rotulo: string; cor: string }

/**
 * `renderBase(mockup:3178)`.
 *
 * REGRA QUE NÃO SE DOBRA: os indicadores olham SEMPRE a base inteira, nunca a
 * lista filtrada. Filtrar por uma etapa não pode fazer o painel zerar e dar a
 * impressão de que a operação parou. Por isso esta função recebe `todas`, e a
 * tela nunca lhe passa o resultado de `filtrar()`.
 */
export function kpisDaBase(todas: Obra[]): Kpi[] {
  const ACCENT = '#f05a28'
  const OK = '#35c98a'
  const CRIT = '#ff4d6d'
  const WARN = '#f4b73f'

  const andamento = todas.filter((o) => o.etapa === 'andamento').length
  const paralisadas = todas.filter((o) => o.etapa === 'paralisado').length
  const velhas = todas.filter((o) => !posCampo(o) && o.dias !== null && o.dias >= 60).length
  const estouradas = todas.filter((o) => !posCampo(o) && o.atraso !== null && o.atraso > 0).length

  const aDefinir = todas.filter((o) => o.etapa === 'definir')
  const maisVelha = aDefinir.reduce((m, o) => Math.max(m, o.dias ?? 0), 0)

  // O indicador que não existia: obra já executada em campo e ainda presa numa
  // etapa de papel. Na planilha inteira são 89 — é onde o dinheiro está parado.
  const esteira = todas.filter((o) => posCampo(o) && !encerrada(o))
  const esteiraVelha = esteira.reduce((m, o) => Math.max(m, o.paradaEtapa ?? 0), 0)

  const semOS = todas.filter((o) => !o.os_aprovada && !encerrada(o)).length
  // O número que hoje ninguém consegue responder.
  const semCob = todas.filter((o) => semCobertura(o)).length

  return [
    {
      valor: aDefinir.length,
      rotulo: aDefinir.length
        ? `aguardando definição · a mais antiga há ${maisVelha} dias`
        : 'aguardando definição',
      cor: ACCENT,
    },
    { valor: andamento, rotulo: 'em andamento', cor: OK },
    { valor: paralisadas, rotulo: 'paralisadas', cor: CRIT },
    {
      valor: esteira.length,
      rotulo: esteira.length
        ? `executadas, ainda na esteira · a mais parada há ${esteiraVelha} dias`
        : 'executadas, ainda na esteira',
      cor: WARN,
    },
    { valor: semOS, rotulo: 'sem OS aprovada no cliente', cor: CRIT },
    { valor: semCob, rotulo: 'sem cobertura — nem OS nem liberação', cor: CRIT },
    { valor: velhas, rotulo: 'aprovadas há mais de 60 dias', cor: WARN },
    { valor: estouradas, rotulo: 'passaram da duração planejada', cor: WARN },
  ]
}
