/**
 * Controle de Obras — tipos e regras de negócio.
 *
 * Este arquivo é a FUNDAÇÃO COMPARTILHADA do módulo: as telas de Base, Ficha,
 * Triagem, Diário e Tarefas importam daqui. Não duplicar nenhuma destas regras
 * dentro de componente.
 *
 * Origem de tudo que está aqui:
 *   docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-obras.html (aprovado)
 *   docs/cliente/2026-08-31-sistema-controle-de-obras/spec-v0-treinamento.md §4
 * Os limiares (duracao*4, 120, 3, 15, 60) foram copiados do mockup linha a
 * linha; atenção > 20 e crítica > 30 vêm do feedback 14 (15/09/2026). Mudá-los
 * é mudar o produto aprovado — não é ajuste técnico.
 *
 * CONVENÇÃO DE NOMES, e ela é semântica:
 *   snake_case  = coluna que existe no banco (obras_obra.os_aprovada)
 *   camelCase   = campo DERIVADO, calculado a cada render, nunca gravado
 * Se você está tentando persistir um campo camelCase, está errado — a spec §4.1
 * é explícita: gravar derivado é garantir que ele fique velho.
 */

// ============================================================
// 1. Data — "hoje" e aritmética de dias
// ============================================================

/**
 * O mockup tem `HOJE` fixo em 2026-08-31. Em produção "hoje" é o dia real, e
 * ele tem que ser o dia em SÃO PAULO, não o do relógio do container: o hub roda
 * em UTC, e das 21h em diante o dia UTC já virou enquanto no Brasil não. Sem
 * isso, o diário das 21h30 cairia no dia seguinte e a obra apareceria como
 * "não respondida hoje".
 */
export const FUSO = 'America/Sao_Paulo'

/** Data de hoje em São Paulo, no formato ISO `AAAA-MM-DD`. */
export function hojeISO(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

/** Hora de agora em São Paulo, `HH:MM` — usada por `prazoPadrao`. */
export function horaISO(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('hour')}:${parte('minute')}`
}

/** Converte `AAAA-MM-DD` em milissegundos UTC. Retorna null se a data não presta. */
function msDe(iso: string | null | undefined): number | null {
  if (!iso) return null
  const p = iso.split('-')
  if (p.length !== 3) return null
  const ano = Number(p[0])
  const mes = Number(p[1])
  const dia = Number(p[2])
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null
  return Date.UTC(ano, mes - 1, dia)
}

/**
 * Dias inteiros entre `iso` e hoje. Positivo = passado.
 * `diasDesde(mockup:1096)`. A conta é feita em UTC de propósito: a versão do
 * mockup usa `new Date(ano, mes, dia)` local e erra por um dia na virada do
 * horário de verão. Aqui os dois lados são UTC, então a subtração é exata.
 */
export function diasDesde(iso: string | null | undefined, hoje: string = hojeISO()): number | null {
  const alvo = msDe(iso)
  const ref = msDe(hoje)
  if (alvo === null || ref === null) return null
  return Math.round((ref - alvo) / 86400000)
}

/** `iso + n` dias, em ISO. `somaDias(mockup:1107)`. */
export function somaDias(iso: string | null | undefined, n: number | null | undefined): string | null {
  const ms = msDe(iso)
  if (ms === null || n === null || n === undefined) return null
  const d = new Date(ms + n * 86400000)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/**
 * `timestamptz` (ex.: `created_at`) → `AAAA-MM-DD` no dia de SÃO PAULO.
 * `diasDesde` só entende `AAAA-MM-DD`: entregar o timestamp cru devolve null.
 * Pelo dia UTC, a obra sincronizada às 23h de SP cairia no dia seguinte.
 */
export function dataSP(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return hojeISO(d)
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`. Vazio vira travessão. `br(mockup:1102)`. */
export function br(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  if (p.length !== 3) return '—'
  return `${p[2]}/${p[1]}/${p[0]}`
}

/** `moeda(mockup:1116)`. */
export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return (
    'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

// ============================================================
// 2. Catálogos — ciclo de vida, fases, enums
// Os nomes em português são os aprovados pelo cliente. Não reescrever.
// ============================================================

export type Etapa =
  | 'definir'
  | 'levantamento'
  | 'andamento'
  | 'paralisado'
  | 'relatorio'
  | 'aprovarOS'
  | 'fecharOS'
  | 'pendFat'
  | 'faturado'

export type Fase = 'antes' | 'campo' | 'fechamento' | 'faturamento'

export const FASES: { k: Fase; nome: string }[] = [
  { k: 'antes', nome: 'Antes de executar' },
  { k: 'campo', nome: 'Executando' },
  { k: 'fechamento', nome: 'Fechamento' },
  { k: 'faturamento', nome: 'Faturamento' },
]

export type EtapaInfo = {
  k: Etapa
  nome: string
  fase: Fase
  /** Quem é o dono da bola nesta etapa. `donoDa` traduz para o nome da pessoa. */
  dono: string
  onde: string
  /** O valor equivalente na coluna STATUS MANFAC da planilha. Usado pelo import. */
  planilha: string
}

/** `CICLO(mockup:1157)` — a ordem é a que o cliente descreveu. */
export const CICLO: EtapaInfo[] = [
  { k: 'definir', nome: 'Aguardando definição', fase: 'antes', dono: 'Analista', onde: 'Manfac', planilha: '' },
  { k: 'levantamento', nome: 'Levantamento', fase: 'antes', dono: 'Responsável da obra', onde: 'Manfac', planilha: 'EXECUTAR' },
  { k: 'andamento', nome: 'Em andamento', fase: 'campo', dono: 'Equipe em campo', onde: 'Campo', planilha: 'EXECUTAR' },
  { k: 'paralisado', nome: 'Paralisado', fase: 'campo', dono: 'Responsável da obra', onde: 'Campo', planilha: 'EXECUTAR' },
  { k: 'relatorio', nome: 'Relatório de entrega', fase: 'fechamento', dono: 'Equipe / responsável', onde: 'Field Control', planilha: 'deduzido do Field' },
  { k: 'aprovarOS', nome: 'Pendente fechamento', fase: 'fechamento', dono: 'Cliente DPSP', onde: 'Sistema do cliente', planilha: 'EXECUTADO - APROVAR OS' },
  { k: 'fecharOS', nome: 'Fechar OS', fase: 'fechamento', dono: 'Responsável da obra', onde: 'Sistema do cliente', planilha: 'FECHAR OS' },
  { k: 'pendFat', nome: 'Pendente faturamento', fase: 'faturamento', dono: 'Cliente DPSP', onde: 'Sistema do cliente', planilha: 'PENDENTE FATURAMENTO' },
  { k: 'faturado', nome: 'Faturado', fase: 'faturamento', dono: 'Financeiro Manfac', onde: 'Manfac', planilha: 'FATURADO' },
]

export const ETAPAS: Record<Etapa, EtapaInfo> = CICLO.reduce(
  (acc, c) => {
    acc[c.k] = c
    return acc
  },
  {} as Record<Etapa, EtapaInfo>
)

/**
 * A esteira que a ficha desenha: só o trecho de depois de a equipe sair de
 * campo. `aprovarOS` é o DESVIO — só existe quando a obra saiu de campo sem OS
 * aprovada no sistema do cliente. `ESTEIRA(mockup:1155)`.
 */
export const ESTEIRA: Etapa[] = ['relatorio', 'aprovarOS', 'fecharOS', 'pendFat', 'faturado']

/** `BLOQUEIOS(mockup:1197)` — também são os motivos de "não andou". */
export const BLOQUEIOS = [
  'Clima',
  'Cliente / loja',
  'Disponibilidade de equipe',
  'Contratação de prestador',
  'Falta de material',
  'Sem bloqueio',
] as const
export type Bloqueio = (typeof BLOQUEIOS)[number]

export const SEM_BLOQUEIO: Bloqueio = 'Sem bloqueio'

/** `ITENS(mockup:1198)` — as opções de "Faltou algum item?". */
export const ITENS = ['Não faltou', 'Material', 'Ferramenta', 'Equipe', 'Documento / ART', 'Outro'] as const
export type Item = (typeof ITENS)[number]

export const NAO_FALTOU: Item = 'Não faltou'
/** "Foto" não é opção do diário — só chave de roteamento da tarefa automática. */
export const ITEM_FOTO = 'Foto'

export const PRIORIDADES = ['Normal', 'Urgente'] as const
export type Prioridade = (typeof PRIORIDADES)[number]

/**
 * `ORIGENS(mockup-j4-v02:524)` — por onde chegou o OK para executar.
 *
 * PROVISÓRIAS, e o cliente sabe: a suposição 4 do mockup declara o significado
 * e a lista como pendentes. O João decidiu em 18/09 seguir com elas (spec da
 * ficha editável, decisão D3) porque mudar a lista é editar esta constante.
 *
 * NO BANCO `origem` É TEXTO LIVRE, e continua sendo: o importador da planilha
 * gravava qualquer coisa (`importacao.ts:526`). Valor gravado fora desta lista
 * NÃO pode ser descartado nem apagado — o `select` da tela o inclui e
 * `validarAutorizacao` o aceita (risco 6 da spec). Lista fechada aqui
 * apagaria dado do cliente sem ninguém notar.
 */
export const ORIGENS = [
  'Sistema do cliente',
  'E-mail do cliente',
  'Telefone',
  'WhatsApp',
  'Outro',
] as const
export type Origem = (typeof ORIGENS)[number]

/**
 * `TIPOS(mockup-j4-v02:523)` — a natureza do serviço. Mesma regra da `origem`:
 * a coluna é texto livre e valor antigo fora da lista é preservado.
 * A grafia em caixa alta é a da planilha e a do mockup aprovado.
 */
export const TIPOS_OBRA = [
  'CIVIL',
  'ELÉTRICA',
  'HIDRÁULICA',
  'PINTURA',
  'SERRALHERIA',
  'Outro',
] as const
export type TipoObra = (typeof TIPOS_OBRA)[number]

export const AREAS = ['Compras', 'Obras', 'Campo'] as const
export type Area = (typeof AREAS)[number]

export const SITUACOES_TAREFA = ['aberta', 'respondida'] as const
/** O que a coluna `situacao` aceita. "vencida" NUNCA é gravada — ver `sitTarefa`. */
export type SituacaoTarefa = (typeof SITUACOES_TAREFA)[number]

/**
 * Procedência técnica da obra. Hoje só o Field cria obras; `null` significa
 * "não sei de onde veio" e, por segurança, não autoriza o D2 a marcar ausência.
 */
export const FONTES_OBRA = ['field'] as const
export type FonteObra = (typeof FONTES_OBRA)[number]

// ============================================================
// 3. Entidades — espelham as tabelas de sdd-sql-obras-v0.sql
// ============================================================

/** `obras_obra`. Só colunas: nada de derivado aqui. */
export type ObraRow = {
  id: string
  os: string | null
  loja: string | null
  descricao: string | null
  tipo: string | null
  valor: number | null
  origem: string | null
  fonte: FonteObra | null
  /** Identidade imutável da ordem no Field; o número da OS pode ser corrigido. */
  field_id: string | null
  /** Primeira varredura completa em que a ordem não apareceu. */
  field_ausente_desde: string | null
  /** Segunda ausência consecutiva: a partir daqui o alerta fica visível. */
  field_ausente_em: string | null

  analista_cliente: string | null
  pcm: string | null
  equipe: string | null

  os_aprovada: boolean
  liberado_por: string | null
  liberado_em: string | null

  etapa: Etapa
  bloqueio: string | null
  mau_uso: boolean
  prioridade: Prioridade | null

  aprovacao: string | null
  inicio_plan: string | null
  inicio_real: string | null
  duracao: number | null
  fim_real: string | null
  desde_etapa: string | null

  marco_exec_fim: string | null
  marco_relatorio: string | null
  marco_os_aprov: string | null
  marco_fechou_os: string | null
  marco_liberou_fat: string | null
  marco_faturou: string | null

  pendencia: string | null
  pend_resp: string | null
  pend_prazo: string | null
  prox_acao: string | null

  atualizacao: string | null
  nao_andou_seguidos: number
  bloqueada_dias: number
  criado_por: string | null
  created_at: string
  updated_at: string | null
}

/** `obras_diario`. `motivo` é obrigatório quando `andou = false` (decisão C). */
export type DiarioRow = {
  id: string
  obra_id: string
  data: string
  andou: boolean
  motivo: string | null
  item: string
  obs: string | null
  foto_path: string | null
  registrado_por: string | null
  created_at: string
}

/** `obras_tarefa`. */
export type TarefaRow = {
  id: string
  obra_id: string
  item: string
  dono: string | null
  aberta: string
  hora_aberta: string | null
  prazo: string | null
  registrou: string | null
  situacao: SituacaoTarefa
  resposta_em: string | null
  resposta_hora: string | null
  resumo: string | null
  created_at: string
}

/** `obras_pessoa`. `fone` fica nulo até o cadastro existir — o WhatsApp é v1. */
export type PessoaRow = {
  chave: string
  nome: string
  iniciais: string | null
  area: Area | null
  funcao: string | null
  fone: string | null
  created_at: string
}

/** `obras_remarcacao`. Só leitura na v0. */
export type RemarcacaoRow = {
  id: string
  obra_id: string
  data: string | null
  de: string | null
  para: string | null
  motivo: string | null
  created_at: string
}

// ============================================================
// 4. Derivados — calculados a cada render, nunca gravados
// ============================================================

export type Derivados = {
  /** Dias desde a APROVAÇÃO. Alimenta `estourou` e o KPI de 60 dias — NÃO a crítica. */
  dias: number | null
  /** De que data a contagem de atenção/crítica corre. Ver `ancoraDias`. */
  ancora: AncoraDias | null
  /**
   * Dias desde a âncora. É o número do selo, da coluna e de `critico`/
   * `classeDias`. Piso em 0: data futura não vira contagem negativa —
   * diferente de `dias`, que continua podendo contar negativo. Decisão do
   * coordenador sobre a ambiguidade A10 (a spec, em §7/A10, respondia
   * provisoriamente "não trata, igual a hoje" — o piso é a resposta
   * definitiva, não a da spec).
   */
  diasAlerta: number | null
  /** Fim previsto = início (real ou planejado) + duração. */
  fimCalc: string | null
  /** Dias passados do fim previsto. Só antes de sair de campo. */
  atraso: number | null
  /** "dia N de M" — quanto do prazo combinado já passou. NÃO é avanço físico. */
  diaDe: number | null
  /** `diaDe / duracao`. Null quando não há duração planejada. */
  fracPrazo: number | null
  /** Dias parada NA ETAPA atual. Só depois de sair de campo. */
  paradaEtapa: number | null
  /** Nome de quem está com a bola, já resolvido para pessoa. */
  dono: string
}

/** Obra pronta para a tela: linha do banco + os derivados. */
export type Obra = ObraRow & Derivados

/** A fase da obra. `faseDe(mockup:1186)`. Etapa desconhecida cai em "campo". */
export function faseDe(o: Pick<ObraRow, 'etapa'>): Fase {
  return ETAPAS[o.etapa] ? ETAPAS[o.etapa].fase : 'campo'
}

/** Já saiu de campo: está em fechamento ou faturamento. `posCampo(mockup:1187)`. */
export function posCampo(o: Pick<ObraRow, 'etapa'>): boolean {
  const f = faseDe(o)
  return f === 'fechamento' || f === 'faturamento'
}

/** Fim de linha. `encerrada(mockup:1188)`. */
export function encerrada(o: Pick<ObraRow, 'etapa'>): boolean {
  return o.etapa === 'faturado'
}

/**
 * Há quanto tempo a obra está parada NA ETAPA em que está — o número que hoje
 * não existe: a planilha guarda o status, nunca desde quando.
 * `paradaNaEtapa(mockup:1191)`.
 */
export function paradaNaEtapa(
  o: Pick<ObraRow, 'desde_etapa' | 'atualizacao'>,
  hoje: string = hojeISO()
): number | null {
  return diasDesde(o.desde_etapa || o.atualizacao, hoje)
}

/** Só obra EM CAMPO tem evolução para fotografar. `pedeFoto(mockup:1759)`. */
export function pedeFoto(o: Pick<ObraRow, 'etapa'>): boolean {
  return faseDe(o) === 'campo'
}

/** `donoDa(mockup:1192)`. */
export function donoDa(o: Pick<ObraRow, 'etapa' | 'pcm' | 'analista_cliente'>): string {
  const c = ETAPAS[o.etapa]
  if (!c) return '—'
  if (c.dono === 'Responsável da obra') return o.pcm ? 'Responsável ' + o.pcm : 'Responsável a definir'
  if (c.dono === 'Analista') return 'Analista ' + (o.analista_cliente || '')
  return c.dono
}

/**
 * Calcula os derivados de uma obra. É o equivalente ao `OBRAS.forEach` do
 * mockup (`:1762-1797`), só que sem escrever de volta na linha do banco.
 *
 * NO LUGAR DO "AVANÇO %": na planilha o avanço é preenchido no olho — a mesma
 * coluna tem 0,9 · 0,2 · 0,5 misturados com 95 e 1, e 5 das 19 obras em branco.
 * Aqui, sem duração planejada `diaDe` fica null e a tela escreve "sem prazo
 * definido" em vez de inventar número.
 */
export function derivar(o: ObraRow, hoje: string = hojeISO()): Obra {
  const dias = diasDesde(o.aprovacao, hoje)
  const ancora = ancoraDias(o)
  const diasAlertaBruto = ancora ? diasDesde(ancora.data, hoje) : null
  const diasAlerta = diasAlertaBruto !== null ? Math.max(0, diasAlertaBruto) : null
  const ini = o.inicio_real || o.inicio_plan
  const fimCalc = ini && o.duracao ? somaDias(ini, o.duracao) : null
  const atraso = !posCampo(o) && fimCalc ? diasDesde(fimCalc, hoje) : null

  let diaDe: number | null = null
  let fracPrazo: number | null = null
  if (ini && o.duracao && !posCampo(o)) {
    const corridos = (diasDesde(ini, hoje) ?? 0) + 1
    diaDe = Math.max(1, corridos)
    fracPrazo = diaDe / o.duracao
  } else if (posCampo(o) && o.duracao) {
    diaDe = o.duracao
    fracPrazo = 1
  }

  return {
    ...o,
    dias,
    ancora,
    diasAlerta,
    fimCalc,
    atraso,
    diaDe,
    fracPrazo,
    paradaEtapa: posCampo(o) ? paradaNaEtapa(o, hoje) : null,
    dono: donoDa(o),
  }
}

/**
 * A data em que a obra ENTROU no hub — o dia de São Paulo do `created_at`.
 *
 * Existe para a Triagem parar de mentir (R23 da spec da ficha editável): ela
 * escreve "Ela entrou pelo Field em …" lendo `obra.aprovacao`
 * (`_triagem.tsx:146`), que é a data de autorização da antiga importação de
 * planilha e é `null` em toda obra do Field. Assim que a ficha editável começar
 * a gravar `aprovacao`, aquele texto passaria a exibir a data de aprovação da
 * OS como se fosse a data de entrada.
 *
 * É a MESMA data que `ancoraDias` chama de 'entrada' — um nome só para um
 * conceito só.
 */
export function entradaDaObra(o: Pick<ObraRow, 'created_at'>): string | null {
  return dataSP(o.created_at)
}

// ============================================================
// 4b. Âncora da contagem de atenção / crítica
// Cliente (feedback 14, seção E): "atenção acima de 20 dias da data de aprovação
// da OS ou liberação, a que for menor. Acima de 30 dias já é crítico".
// Decisão 5 revista (14/09): a data MAIS ANTIGA entre liberação e aprovação;
// sem nenhuma das duas, a entrada.
// Decisão do João (15/09, o "caso 12"): registrar uma data NUNCA pode derrubar
// a contagem — nem quando a data nova é a liberação. Por isso a ENTRADA é
// candidata SEMPRE, não só quando faltam aprovação e liberação: a âncora é a
// mais antiga entre as três. Mudar isto é mudar o produto.
// ============================================================

export const LIMIAR_ATENCAO = 20
export const LIMIAR_CRITICO = 30

export type AncoraDias = { de: 'aprovacao' | 'liberacao' | 'entrada'; data: string }

export function ancoraDias(
  o: Pick<ObraRow, 'aprovacao' | 'liberado_por' | 'liberado_em' | 'created_at'>
): AncoraDias | null {
  const aprov = msDe(o.aprovacao) !== null ? (o.aprovacao as string) : null
  // Sem nome de quem liberou, a data da liberação não significa nada — a mesma
  // regra que a action de liberar aplica ao gravar.
  const lib = o.liberado_por && msDe(o.liberado_em) !== null ? (o.liberado_em as string) : null
  const entrada = dataSP(o.created_at)

  // A mais antiga das três vence. Em empate, a fonte mais "oficial" —
  // aprovação > liberação > entrada — decide (a mesma prioridade que a
  // decisão 5 revista já dava a aprovação sobre liberação).
  let melhor: AncoraDias | null = entrada ? { de: 'entrada', data: entrada } : null
  if (lib && (!melhor || lib <= melhor.data)) melhor = { de: 'liberacao', data: lib }
  if (aprov && (!melhor || aprov <= melhor.data)) melhor = { de: 'aprovacao', data: aprov }
  return melhor
}

// ============================================================
// 5. Regras de leitura — o que é urgente e o que não é
//
// ESCALA DE URGÊNCIA: vermelho é obra em aberto há MAIS DE 30 dias desde a
// âncora (a data mais antiga entre liberação e aprovação, ou a entrada). Até
// 14/09 o limiar era 100 dias; o cliente o baixou no feedback 14. Passar da
// duração, ficar travada no bloqueio ou esperar definição é âmbar.
// ============================================================

/** `critico(mockup:1805)`. Crítica: em aberto há mais de 30 dias desde a âncora (feedback 14, seção E). */
export function critico(o: Obra): boolean {
  return (
    !encerrada(o) &&
    o.etapa !== 'definir' &&
    o.diasAlerta !== null &&
    o.diasAlerta > LIMIAR_CRITICO
  )
}

/** `estourou(mockup:1808)` — passou MUITO da duração combinada. */
export function estourou(o: Obra): boolean {
  if (posCampo(o) || o.etapa === 'definir') return false
  if (o.dias === null) return false
  return o.duracao ? o.dias > o.duracao * 4 : o.dias >= 120
}

/**
 * `travado(mockup:1812)` — parada no mesmo bloqueio há 3 dias ou mais.
 * DIVERGÊNCIA DELIBERADA DO MOCKUP: lá `bloqueio` sempre existe; aqui a coluna
 * é nullable, e `null !== 'Sem bloqueio'` seria `true` — obra sem bloqueio
 * nenhum apareceria travada. Null é tratado como "sem bloqueio".
 */
export function travado(o: Obra): boolean {
  return (
    !posCampo(o) &&
    o.bloqueada_dias >= 3 &&
    o.bloqueio !== null &&
    o.bloqueio !== SEM_BLOQUEIO
  )
}

/**
 * `encalhada(mockup:1818)` — já saiu de campo e empacou numa etapa de papel.
 * É o buraco que o cliente descreveu: 89 obras da base já foram executadas e
 * ainda não viraram dinheiro, e ninguém enxerga em qual passo cada uma parou.
 */
export function encalhada(o: Obra): boolean {
  return posCampo(o) && !encerrada(o) && o.paradaEtapa !== null && o.paradaEtapa >= 15
}

/**
 * AUTORIZAÇÃO — dois destravamentos independentes, quatro combinações:
 *   liberada e com OS     → normal
 *   liberada, sem OS      → executando com o OK do analista; falta cobrar a OS
 *   não liberada, com OS  → normal (a OS já é a autorização)
 *   nem uma nem outra     → SEM COBERTURA: serviço feito, sem documento e sem
 *                           ninguém nomeado que tenha autorizado
 * Obra aguardando definição não conta — ninguém foi a campo.
 * `liberada(mockup:1862)` / `semCobertura(mockup:1866)`.
 */
export function liberada(o: Pick<ObraRow, 'liberado_por'>): boolean {
  return !!o.liberado_por
}

export function semCobertura(o: Pick<ObraRow, 'os_aprovada' | 'liberado_por' | 'etapa'>): boolean {
  return !o.os_aprovada && !o.liberado_por && o.etapa !== 'definir' && !encerrada(o)
}

/**
 * Há quantos dias a OS não sai. Conta da liberação, quando houve alguém que
 * liberou — é a partir dela que a promessa "a OS eu aprovo depois" corre.
 * `diasSemOS(mockup:1871)`.
 */
export function diasSemOS(
  o: Pick<ObraRow, 'os_aprovada' | 'liberado_em' | 'inicio_real' | 'inicio_plan' | 'aprovacao'>,
  hoje: string = hojeISO()
): number | null {
  if (o.os_aprovada) return null
  return diasDesde(o.liberado_em || o.inicio_real || o.inicio_plan || o.aprovacao, hoje)
}

/**
 * Severidade, na ordem de prioridade fixa do mockup (`sev`, `:1821`).
 * Devolve um TOKEN, não uma cor: quem pinta é a tela, via `COR_SEV`. A ordem
 * dos `if` é a regra — não reordenar.
 */
export type Sev =
  | 'encerrada'
  | 'critico'
  | 'semCobertura'
  | 'definir'
  | 'encalhada'
  | 'posCampo'
  | 'atencao'
  | 'levantamento'
  | 'ok'

export function sev(o: Obra): Sev {
  if (encerrada(o)) return 'encerrada'
  if (critico(o)) return 'critico'
  // Sem cobertura pesa igual a obra crítica, e pelo mesmo motivo: é o caso que
  // ninguém consegue ver hoje e que custa dinheiro quando aparece.
  if (semCobertura(o)) return 'semCobertura'
  if (o.etapa === 'definir') return 'definir'
  if (posCampo(o)) return encalhada(o) ? 'encalhada' : 'posCampo'
  if (estourou(o) || travado(o) || o.etapa === 'paralisado') return 'atencao'
  if (o.atraso !== null && o.atraso > 0) return 'atencao'
  if (o.etapa === 'levantamento') return 'levantamento'
  return 'ok'
}

/** As cores do mockup, na íntegra (`:12-22`). Aprovadas — não trocar. */
export const COR_SEV: Record<Sev, string> = {
  encerrada: '#64748b', // --ink-faint
  critico: '#ff4d6d', // --crit
  semCobertura: '#ff4d6d', // --crit
  definir: '#f05a28', // --accent
  encalhada: '#f4b73f', // --warn
  posCampo: '#5aa9f0', // --info
  atencao: '#f4b73f', // --warn
  levantamento: '#5aa9f0', // --info
  ok: '#35c98a', // --ok
}

/** `classeDias(mockup:1835)` — como pintar o contador de dias. */
export function classeDias(o: Obra): '' | 'critico' | 'atencao' {
  if (encerrada(o) || o.etapa === 'definir') return ''
  if (critico(o)) return 'critico'
  if (estourou(o) || (o.diasAlerta !== null && o.diasAlerta > LIMIAR_ATENCAO)) return 'atencao'
  return ''
}

/** `prazoTxt(mockup:1841)` — o que substituiu o "Avanço %". */
export function prazoTxt(o: Obra): string {
  if (posCampo(o)) return 'prazo cumprido'
  if (o.diaDe === null) return 'sem prazo definido'
  return `dia ${o.diaDe} de ${o.duracao}`
}

/** `paradaTxt(mockup:1846)`. */
export function paradaTxt(o: Obra): string {
  if (posCampo(o)) {
    // `paradaEtapa` é null quando não há `desde_etapa` nem `atualizacao` — o caso
    // de toda obra que veio só da aba Pipeline. Sem esta guarda a tela escreve
    // "null dias nesta etapa", que é pior que não escrever nada.
    if (o.paradaEtapa === null) return 'sem registro de quando parou'
    return `${o.paradaEtapa} ${o.paradaEtapa === 1 ? 'dia nesta etapa' : 'dias nesta etapa'}`
  }
  if (o.nao_andou_seguidos >= 1) {
    return `${o.nao_andou_seguidos} ${o.nao_andou_seguidos === 1 ? 'dia sem andar' : 'dias sem andar'}`
  }
  return 'andou no último registro'
}

// ============================================================
// 6. Tarefas — roteamento, prazo e situação
// ============================================================

export type Rota = { chave: string; acao: string; nosso?: boolean }

/** Chave sentinela: a tarefa vai para a equipe da própria obra. */
export const CHAVE_EQUIPE = '__EQUIPE__'

/**
 * Para quem vai a tarefa, por tipo de falta. `ROTA_FALTA(mockup:2070)`.
 * Material, ferramenta e equipe são palavra do cliente. "Documento / ART" e
 * "Outro" são padrão nosso (decisão J, ainda aberta com o cliente) — por isso
 * `nosso: true`, e por isso a tela marca esses dois como tal.
 */
export const ROTA_FALTA: Record<string, Rota> = {
  Material: { chave: 'ROBERTA', acao: 'ver com quem registrou o que está faltando e comprar' },
  Ferramenta: { chave: 'YURI', acao: 'ver o que precisa ser feito com a ferramenta' },
  Equipe: { chave: 'YURI', acao: 'ver o que dá para remanejar de equipe' },
  'Documento / ART': { chave: 'YURI', acao: 'providenciar o documento ou a ART com o engenheiro', nosso: true },
  Outro: { chave: 'YURI', acao: 'ler o que foi registrado e dizer quem resolve', nosso: true },
  // A foto que não veio é falta como qualquer outra — e a única cuja cobrança
  // vai para a EQUIPE em campo, não para o escritório: é ela que está na obra.
  Foto: { chave: CHAVE_EQUIPE, acao: 'mandar a foto da evolução de hoje', nosso: true },
}

export function destinoDe(item: string): Rota | null {
  return ROTA_FALTA[item] ?? null
}

/**
 * A chave da equipe da obra em `obras_pessoa`. `chaveDaEquipe(mockup:2093)`.
 * A planilha guarda a equipe como texto solto (MANFAC-19, ALEX, DEFINIR), sem
 * telefone nenhum — daí a normalização.
 */
export function chaveDaEquipe(o: Pick<ObraRow, 'equipe'>): string {
  const nome = o.equipe && o.equipe !== 'DEFINIR' ? o.equipe : 'Equipe a definir'
  return 'EQ_' + nome.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/** O nome legível da equipe, o mesmo que `chaveDaEquipe` normaliza. */
export function nomeDaEquipe(o: Pick<ObraRow, 'equipe'>): string {
  return o.equipe && o.equipe !== 'DEFINIR' ? o.equipe : 'Equipe a definir'
}

/**
 * Prazo padrão da tarefa: até o fim do dia — a fala é do cliente, "me responda
 * aqui até o final do dia". Falta registrada depois das 18h fica com o dia
 * seguinte, senão a tarefa nasceria vencida no mesmo minuto.
 * `prazoPadrao(mockup:2106)`.
 *
 * NOTA: o comentário do mockup diz "dia útil seguinte", mas o código soma 1 dia
 * corrido, e é esse o comportamento aprovado na tela. Copiado como está. Pular
 * fim de semana é mudança de regra — vai ao cliente antes, não aqui.
 */
export function prazoPadrao(dia: string, hora?: string | null): string | null {
  const depoisDas18 = !!hora && hora > '18:00'
  return depoisDas18 ? somaDias(dia, 1) : dia
}

/**
 * A situação real da tarefa. `sitTarefa(mockup:2212)`.
 * "vencida" NUNCA é gravada — é sempre calculada contra hoje. Gravar vencida é
 * gravar derivado, e derivado gravado fica velho.
 */
export function sitTarefa(
  t: Pick<TarefaRow, 'situacao' | 'prazo'>,
  hoje: string = hojeISO()
): 'aberta' | 'respondida' | 'vencida' {
  if (t.situacao === 'respondida') return 'respondida'
  const d = diasDesde(t.prazo, hoje)
  if (d !== null && d > 0) return 'vencida'
  return 'aberta'
}

/** Nome da etapa como aparece na tela. Etapa desconhecida devolve a própria chave. */
export function nomeEtapa(etapa: Etapa): string {
  return ETAPAS[etapa]?.nome ?? etapa
}

/** Nome da fase como aparece no Kanban (que agrupa por FASE, não por etapa). */
export function nomeFase(fase: Fase): string {
  return FASES.find((f) => f.k === fase)?.nome ?? fase
}

// ============================================================
// 7. Contadores do diário — os números que a tela mostra e ninguém digita
//
// `nao_andou_seguidos` e `bloqueada_dias` são lidos em seis lugares (o alerta de
// "3 dias sem andar" no diário, o "há N dias" da ficha, a etiqueta da tabela e
// `travado()`), mas NADA os escrevia: nasciam 0 no banco e ficavam parados para
// sempre. Ou seja, a obra podia estar parada há duas semanas e a tela dizia
// "andou no último registro". Estas são as duas colunas que o sistema existe
// para mostrar, então elas são recalculadas do histórico a cada resposta do
// diário — nunca incrementadas às cegas, senão corrigir a resposta de hoje
// contaria duas vezes.
// ============================================================

export type RegistroDiario = { andou: boolean; motivo: string | null }

export type ContadoresDiario = {
  nao_andou_seguidos: number
  bloqueada_dias: number
  bloqueio: Bloqueio
}

/**
 * Os contadores da obra, deduzidos do histórico do diário.
 *
 * `recentesPrimeiro` são os registros do diário da obra, do mais novo para o
 * mais velho. "Seguidos" conta REGISTROS seguidos, não dias de calendário: fim
 * de semana não tem registro e não pode quebrar a sequência de uma obra que
 * está parada desde quinta.
 */
export function contadoresDoDiario(recentesPrimeiro: RegistroDiario[]): ContadoresDiario {
  const vazio: ContadoresDiario = { nao_andou_seguidos: 0, bloqueada_dias: 0, bloqueio: SEM_BLOQUEIO }
  const ultimo = recentesPrimeiro[0]
  if (!ultimo) return vazio

  let naoAndou = 0
  for (const r of recentesPrimeiro) {
    if (r.andou) break
    naoAndou++
  }

  // Andou hoje encerra o bloqueio: o que valia ontem não vale mais.
  if (ultimo.andou) return { ...vazio, nao_andou_seguidos: 0 }

  const motivo = ultimo.motivo
  if (!motivo || motivo === SEM_BLOQUEIO || !BLOQUEIOS.includes(motivo as Bloqueio)) {
    return { nao_andou_seguidos: naoAndou, bloqueada_dias: 0, bloqueio: SEM_BLOQUEIO }
  }

  let mesmoBloqueio = 0
  for (const r of recentesPrimeiro) {
    if (r.andou || r.motivo !== motivo) break
    mesmoBloqueio++
  }

  return {
    nao_andou_seguidos: naoAndou,
    bloqueada_dias: mesmoBloqueio,
    bloqueio: motivo as Bloqueio,
  }
}
