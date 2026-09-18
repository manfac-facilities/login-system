'use client'

/**
 * TRIAGEM — o modo da Ficha quando `etapa === 'definir'`.
 *
 * Não é rota separada e nem aba: é a mesma URL da obra, desviada
 * (`renderFicha` → `renderTriagem`, mockup:3399). Enquanto os cinco campos não
 * estiverem preenchidos, a obra não aparece para ninguém responder no diário —
 * é o checklist antes de começar a obra.
 *
 * "Liberado por" e "Data da liberação" são OPCIONAIS e ficam fora do checklist,
 * de propósito: obra com OS aprovada não precisa de liberação, e obrigar o
 * campo faria alguém inventar um nome só para destravar a tela.
 *
 * **SALVAR DADOS É SEPARADO DE LIBERAR** (E1 da spec da ficha editável, seção A
 * do `mockup-j4-v03.html`): a liberação chega por telefone antes da obra, e a
 * aprovação da OS costuma chegar meses depois. Quem já sabe quem liberou, o
 * tipo, o valor ou a aprovação antes de ter equipe grava agora o que preencheu,
 * sem liberar e sem inventar dado. A obra continua em "Aguardando definição".
 *
 * **ORIGEM MORA NA AUTORIZAÇÃO**, não em "Dados da obra" (E2, feedback 14 A):
 * "por onde chegou o OK" é parte da autorização. Na ficha ela mudou de lugar da
 * mesma forma.
 *
 * O CLIENTE NÃO É "A DPSP". Feedback 14 A, literal: *"o texto está vinculado
 * muito a DPSP, mas isso será usado para todas as obras da Manfac em todos os
 * clientes"*. Nada nesta tela nomeia um cliente específico.
 *
 * Textos reproduzidos do mockup aprovado — não reescrever.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Box, BoxB, BoxH, Botao, Campo, Campos, Placeholder } from '../../_ui/primitivos'
import {
  ORIGENS,
  PRIORIDADES,
  TIPOS_OBRA,
  br,
  diasDesde,
  entradaDaObra,
  moeda,
  type Obra,
} from '../../_lib/tipos'
import {
  moedaParaTexto,
  primeiroErro,
  validarAutorizacao,
  validarIdentificacao,
} from '../../_lib/ficha-campos'
import { BadgeDias, EtiquetaEtapa } from '../../base/_etiquetas'
import { liberarObraAction, salvarDadosTriagemAction } from './_actions'

type Rascunho = {
  resp: string
  equipe: string
  prioridade: string
  inicio: string
  duracao: string
  libPor: string
  libEm: string
  /** A partir da ficha editável (§4.6): gravados no Liberar e no Salvar dados. */
  origem: string
  tipo: string
  /** Texto pt-BR: '4.380,00'. `numeroBR` converte na gravação. */
  valor: string
  analista: string
  /** `AAAA-MM-DD`; '' = OS ainda não aprovada. */
  aprovadaEm: string
}

/** `CAMPOS_TRI(mockup:1966)` — os cinco, na ordem em que aparecem. */
const CAMPOS_TRI: { k: keyof Rascunho; rot: string }[] = [
  { k: 'resp', rot: 'Responsável da obra' },
  { k: 'equipe', rot: 'Equipe / prestador' },
  { k: 'prioridade', rot: 'Prioridade' },
  { k: 'inicio', rot: 'Data de início' },
  { k: 'duracao', rot: 'Duração em dias' },
]

/** `textoFaltam(mockup:3906)`. */
function textoFaltam(faltam: number): string {
  return faltam
    ? `Faltam ${faltam} ${faltam === 1 ? 'campo' : 'campos'}. Enquanto isso a obra não aparece para ninguém responder.`
    : 'Pronta. Ao liberar, ela entra na base como Levantamento e passa a ser cobrada todo dia.'
}

const INPUT =
  'w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] disabled:opacity-50'

function CampoTri({
  n,
  rotulo,
  preenchido,
  dica,
  children,
}: {
  n: string
  rotulo: string
  preenchido: boolean
  dica?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-[#1e3a5f] bg-[#0a1628] p-3">
      <span className="flex items-center gap-2 text-sm text-[#e8eef7]">
        <span
          className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold"
          style={
            preenchido
              ? { backgroundColor: '#35c98a', color: '#0a1628' }
              : { backgroundColor: '#1e3a5f', color: '#94a3b8' }
          }
        >
          {preenchido ? '✓' : n}
        </span>
        {rotulo}
      </span>
      {children}
      {dica ? <span className="text-[11px] text-[#64748b]">{dica}</span> : null}
    </div>
  )
}

/**
 * Campo do quadro **Dados da obra**: sem o círculo numerado do checklist, de
 * propósito — nenhum deles é obrigatório para liberar, e o círculo diria o
 * contrário (`campoF` do mockup).
 */
function CampoOpcional({
  id,
  rotulo,
  dica,
  larga,
  children,
}: {
  id: string
  rotulo: string
  dica?: string
  larga?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`min-w-0 ${larga ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="block text-[11px] tracking-wide text-[#94a3b8] uppercase">
        {rotulo}
      </label>
      <div className="mt-1">{children}</div>
      {dica ? (
        <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">{dica}</span>
      ) : null}
    </div>
  )
}

export default function Triagem({
  obra,
  responsaveis,
  equipes,
  analistasCliente,
  hoje,
}: {
  obra: Obra
  responsaveis: readonly string[]
  equipes: readonly string[]
  analistasCliente: readonly string[]
  /** `AAAA-MM-DD` vindo do servidor — a tela não inventa "hoje". */
  hoje: string
}) {
  const router = useRouter()
  const [t, setT] = useState<Rascunho>({
    resp: obra.pcm ?? '',
    equipe: obra.equipe ?? '',
    prioridade: obra.prioridade ?? '',
    inicio: obra.inicio_plan ?? '',
    duracao: obra.duracao !== null ? String(obra.duracao) : '',
    libPor: obra.liberado_por ?? '',
    libEm: obra.liberado_em ?? '',
    origem: obra.origem ?? '',
    tipo: obra.tipo ?? '',
    valor: moedaParaTexto(obra.valor),
    analista: obra.analista_cliente ?? '',
    // R7: `aprovacao` é a coluna que manda. A tela edita UMA data.
    aprovadaEm: obra.aprovacao ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [erroDados, setErroDados] = useState<string | null>(null)
  const [msgDados, setMsgDados] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [salvandoDados, iniciarDados] = useTransition()

  const set = (k: keyof Rascunho) => (v: string) => setT((a) => ({ ...a, [k]: v }))
  const faltam = CAMPOS_TRI.filter((c) => !t[c.k]).length
  const preenchidos = CAMPOS_TRI.length - faltam
  const ocupado = pendente || salvandoDados

  // R23 — a entrada da obra é `created_at`, não `aprovacao`. A coluna antiga é
  // `null` em toda obra do Field (mostrava "—") e, assim que a ficha começar a
  // gravar `aprovacao`, passaria a exibir a data de aprovação da OS como se
  // fosse a data de entrada.
  const entrada = entradaDaObra(obra)
  const esperandoHa = diasDesde(entrada, hoje) ?? 0

  /** A validação da TELA é a mesma função da Server Action (§5.3). */
  function validar(): string | null {
    return (
      primeiroErro(
        validarAutorizacao(
          { origem: t.origem, libPor: t.libPor, libEm: t.libEm, aprovadaEm: t.aprovadaEm },
          { hoje, origemAtual: obra.origem }
        )
      ) ??
      primeiroErro(
        validarIdentificacao(
          { tipo: t.tipo, valor: t.valor, analista: t.analista, mauUso: obra.mau_uso },
          { tipoAtual: obra.tipo }
        )
      )
    )
  }

  function liberar() {
    setErro(null)
    const invalido = validar()
    if (invalido) {
      setErro(invalido)
      return
    }
    iniciar(async () => {
      const r = await liberarObraAction(obra.id, t)
      if (r.error) setErro(r.error)
      else router.push('/obras/base')
    })
  }

  function salvarDados() {
    setErroDados(null)
    setMsgDados(null)
    const invalido = validar()
    if (invalido) {
      setErroDados(invalido)
      return
    }
    iniciarDados(async () => {
      const r = await salvarDadosTriagemAction(obra.id, {
        tipo: t.tipo,
        valor: t.valor,
        analista: t.analista,
        aprovadaEm: t.aprovadaEm,
        origem: t.origem,
        libPor: t.libPor,
        libEm: t.libEm,
      })
      // R21: falhou, nada foi gravado e o que está na tela continua na tela.
      if (r.error) setErroDados(r.error)
      else setMsgDados('Dados salvos. A obra continua em Aguardando definição.')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eef7]">{obra.loja ?? '—'}</h1>
          <p className="mt-0.5 font-mono text-xs text-[#94a3b8]">
            OS {obra.os ?? '—'} · {obra.tipo ?? '—'} · {moeda(obra.valor)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaEtapa obra={obra} />
          <BadgeDias obra={obra} />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f05a28]/50 bg-[#f05a28]/10 px-4 py-3">
        <div className="min-w-[260px] flex-1">
          <h2 className="text-sm font-semibold text-[#f05a28]">
            Obra nova, esperando você definir
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
            Ela entrou pelo Field em <b className="text-[#e8eef7]">{br(entrada)}</b> e está
            esperando há <b className="text-[#e8eef7]">{esperandoHa} dias</b>. Definir a obra que
            chega é tarefa do <b className="text-[#e8eef7]">analista de obras</b>. Ela só entra no
            diário quando estes cinco campos estiverem preenchidos — é o checklist antes de começar
            a obra.
          </p>
        </div>
        <span className="rounded-full border border-[#1e3a5f] bg-[#0a1628] px-3 py-1 text-xs font-semibold whitespace-nowrap text-[#e8eef7]">
          {preenchidos} de {CAMPOS_TRI.length} preenchidos
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Box>
            <BoxH>O que veio do Field</BoxH>
            <BoxB>
              <Campos cols={2}>
                <Campo rotulo="Nº OS">{obra.os}</Campo>
                <Campo rotulo="Loja">{obra.loja}</Campo>
                <Campo rotulo="Chamado">{obra.descricao}</Campo>
              </Campos>
              <p className="mt-3 text-[11px] leading-relaxed text-[#94a3b8]">
                O Field traz só estas três informações, e elas não se editam aqui. Se alguma estiver
                errada, corrija no Field: a sincronização só preenche o que está vazio, então uma
                correção feita aqui nunca mais acompanharia o Field, sem ninguém ser avisado.
              </p>
            </BoxB>
          </Box>

          {/* ---------- Dados da obra: salva sem liberar (E1) ---------- */}
          <Box>
            <BoxH extra="opcional">Dados da obra</BoxH>
            <BoxB>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoOpcional id="a-tipo" rotulo="Tipo">
                  <select
                    id="a-tipo"
                    className={INPUT}
                    value={t.tipo}
                    disabled={ocupado}
                    onChange={(e) => set('tipo')(e.target.value)}
                  >
                    <option value="">— não sei ainda —</option>
                    {(t.tipo && !(TIPOS_OBRA as readonly string[]).includes(t.tipo)
                      ? [t.tipo, ...TIPOS_OBRA]
                      : TIPOS_OBRA
                    ).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </CampoOpcional>

                <CampoOpcional id="a-valor" rotulo="Valor (R$)">
                  <input
                    id="a-valor"
                    type="text"
                    inputMode="decimal"
                    placeholder="ex.: 4.380,00"
                    className={INPUT}
                    value={t.valor}
                    disabled={ocupado}
                    onChange={(e) => set('valor')(e.target.value)}
                  />
                </CampoOpcional>

                <CampoOpcional
                  id="a-analista"
                  rotulo="Analista do cliente"
                  dica="analista do cliente dono da OS"
                  larga
                >
                  <select
                    id="a-analista"
                    className={INPUT}
                    value={t.analista}
                    disabled={ocupado}
                    onChange={(e) => set('analista')(e.target.value)}
                  >
                    <option value="">— não sei ainda —</option>
                    {(t.analista && !analistasCliente.includes(t.analista)
                      ? [t.analista, ...analistasCliente]
                      : analistasCliente
                    ).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </CampoOpcional>

                <CampoOpcional
                  id="a-aprov"
                  rotulo="OS aprovada em"
                  dica="Vazio: OS ainda não aprovada. Com data: a OS conta como aprovada no sistema do cliente, e os dias esperando a aprovação da OS não correm."
                  larga
                >
                  <input
                    id="a-aprov"
                    type="date"
                    max={hoje}
                    className={INPUT}
                    value={t.aprovadaEm}
                    disabled={ocupado}
                    onChange={(e) => set('aprovadaEm')(e.target.value)}
                  />
                </CampoOpcional>
              </div>

              <div className="mt-3 flex flex-col gap-2 border-t border-[#1e3a5f] pt-3">
                <Botao
                  type="button"
                  tipo="secundario"
                  id="a-salvar-dados"
                  onClick={salvarDados}
                  disabled={ocupado}
                >
                  {salvandoDados ? 'Salvando…' : 'Salvar dados'}
                </Botao>
                <span
                  id="a-dados-msg"
                  aria-live="polite"
                  className={`text-[11px] leading-relaxed ${msgDados ? 'text-[#35c98a]' : 'text-[#94a3b8]'}`}
                >
                  {msgDados ??
                    'Grava tudo o que estiver preenchido nesta tela, inclusive a autorização, sem liberar: a obra continua em Aguardando definição.'}
                </span>
                {erroDados ? (
                  <div
                    role="alert"
                    className="rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] leading-relaxed text-[#cbd5e1]"
                  >
                    <strong className="block text-[#ff4d6d]">Não salvou os dados da obra</strong>
                    <p className="mt-1">
                      O sistema não confirmou a gravação, então{' '}
                      <b className="text-[#e8eef7]">nada foi salvo</b>. O que você digitou continua
                      na tela. Clique em Salvar dados de novo; se falhar outra vez, anote os valores
                      antes de sair desta página.
                    </p>
                    <p className="mt-1 text-[#94a3b8]">O sistema respondeu: {erroDados}</p>
                  </div>
                ) : null}
              </div>
            </BoxB>
          </Box>

          <Box>
            <BoxH>Como esta obra apareceu aqui</BoxH>
            <BoxB className="flex flex-col gap-2">
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                A obra é aprovada pelo cliente, alguém abre a OS no Field e o sistema traz a linha
                para a base sozinho — com o que o Field tem, que é pouco.
              </p>
              <Placeholder alto>
                <span>
                  <b>O Field não manda</b> responsável, equipe, prioridade nem cronograma. Por isso a
                  obra para aqui antes de virar rotina de diário.
                </span>
              </Placeholder>
            </BoxB>
          </Box>
        </div>

        <div className="flex flex-col gap-4">
          <Box>
            <BoxH>O que falta definir</BoxH>
            <BoxB className="flex flex-col gap-2.5">
              <CampoTri n="1" rotulo="Responsável da obra" preenchido={!!t.resp}>
                <select
                  className={INPUT}
                  aria-label="Responsável da obra"
                  value={t.resp}
                  disabled={ocupado}
                  onChange={(e) => set('resp')(e.target.value)}
                >
                  <option value="">— escolher —</option>
                  {responsaveis.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </CampoTri>

              <CampoTri n="2" rotulo="Equipe / prestador" preenchido={!!t.equipe}>
                <select
                  className={INPUT}
                  aria-label="Equipe ou prestador"
                  value={t.equipe}
                  disabled={ocupado}
                  onChange={(e) => set('equipe')(e.target.value)}
                >
                  <option value="">— escolher —</option>
                  {equipes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </CampoTri>

              <CampoTri n="3" rotulo="Prioridade" preenchido={!!t.prioridade}>
                <select
                  className={INPUT}
                  aria-label="Prioridade"
                  value={t.prioridade}
                  disabled={ocupado}
                  onChange={(e) => set('prioridade')(e.target.value)}
                >
                  <option value="">— escolher —</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </CampoTri>

              <CampoTri
                n="4"
                rotulo="Data de início"
                preenchido={!!t.inicio}
                dica="quando a equipe entra na loja"
              >
                <input
                  type="date"
                  className={INPUT}
                  aria-label="Data de início"
                  value={t.inicio}
                  disabled={ocupado}
                  onChange={(e) => set('inicio')(e.target.value)}
                />
              </CampoTri>

              <CampoTri
                n="5"
                rotulo="Duração em dias"
                preenchido={!!t.duracao}
                dica="a data final o sistema calcula"
              >
                <input
                  type="number"
                  min={1}
                  max={180}
                  className={INPUT}
                  aria-label="Duração em dias"
                  value={t.duracao}
                  disabled={ocupado}
                  onChange={(e) => set('duracao')(e.target.value)}
                />
              </CampoTri>

              <div className="flex flex-col gap-2 border-t border-[#1e3a5f] pt-3">
                <Botao type="button" onClick={liberar} disabled={faltam > 0 || ocupado}>
                  {pendente ? 'Liberando…' : 'Liberar para o diário do dia'}
                </Botao>
                <span className="text-[11px] leading-relaxed text-[#94a3b8]">
                  {textoFaltam(faltam)}
                </span>
                {erro ? <span className="text-xs font-semibold text-[#ff4d6d]">{erro}</span> : null}
              </div>
            </BoxB>
          </Box>

          <Box>
            <BoxH>Autorização para executar</BoxH>
            <BoxB className="flex flex-col gap-2.5">
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                {t.aprovadaEm ? (
                  <>
                    Esta obra já tem <b className="text-[#35c98a]">OS aprovada</b> em{' '}
                    {br(t.aprovadaEm)} (informada em Dados da obra). Não precisa de liberação: a OS
                    já é a autorização. Se alguém também liberou, registre mesmo assim.
                  </>
                ) : (
                  <>
                    Esta obra <b className="text-[#f05a28]">ainda não tem OS aprovada</b>. Se o
                    cliente autorizou começar mesmo assim, registre por onde chegou o OK, quem deu e
                    quando. Sem isso a obra vai para campo sem ninguém nomeado que tenha autorizado.
                  </>
                )}
              </p>

              {/* E2: a Origem saiu de "Dados da obra" e entrou aqui. */}
              <CampoTri
                n="·"
                rotulo="Origem"
                preenchido={!!t.origem}
                dica="por onde chegou o OK para executar"
              >
                <select
                  className={INPUT}
                  aria-label="Origem"
                  value={t.origem}
                  disabled={ocupado}
                  onChange={(e) => set('origem')(e.target.value)}
                >
                  <option value="">— não sei ainda —</option>
                  {(t.origem && !(ORIGENS as readonly string[]).includes(t.origem)
                    ? [t.origem, ...ORIGENS]
                    : ORIGENS
                  ).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </CampoTri>

              <CampoTri
                n="·"
                rotulo="Liberado por"
                preenchido={!!t.libPor}
                dica="analista do cliente que deu o OK"
              >
                <select
                  className={INPUT}
                  aria-label="Liberado por"
                  value={t.libPor}
                  disabled={ocupado}
                  onChange={(e) => set('libPor')(e.target.value)}
                >
                  <option value="">— ninguém liberou —</option>
                  {analistasCliente.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </CampoTri>

              <CampoTri
                n="·"
                rotulo="Data da liberação"
                preenchido={!!t.libEm}
                dica="é outra data, não a da aprovação da OS"
              >
                <input
                  type="date"
                  max={hoje}
                  className={INPUT}
                  aria-label="Data da liberação"
                  value={t.libEm}
                  disabled={ocupado}
                  onChange={(e) => set('libEm')(e.target.value)}
                />
              </CampoTri>
            </BoxB>
          </Box>
        </div>
      </div>
    </div>
  )
}
