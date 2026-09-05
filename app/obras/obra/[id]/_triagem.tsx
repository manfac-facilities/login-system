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
 * Textos reproduzidos do mockup aprovado — não reescrever.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Box, BoxB, BoxH, Botao, Campo, Campos, Placeholder } from '../../_ui/primitivos'
import { PRIORIDADES, br, moeda, type Obra } from '../../_lib/tipos'
import { BadgeDias, EtiquetaEtapa } from '../../base/_etiquetas'
import { liberarObraAction } from './_actions'

type Rascunho = {
  resp: string
  equipe: string
  prioridade: string
  inicio: string
  duracao: string
  libPor: string
  libEm: string
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
  'w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28]'

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

export default function Triagem({
  obra,
  responsaveis,
  equipes,
  analistasCliente,
}: {
  obra: Obra
  responsaveis: string[]
  equipes: string[]
  analistasCliente: string[]
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
  })
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const set = (k: keyof Rascunho) => (v: string) => setT((a) => ({ ...a, [k]: v }))
  const faltam = CAMPOS_TRI.filter((c) => !t[c.k]).length
  const preenchidos = CAMPOS_TRI.length - faltam

  function liberar() {
    setErro(null)
    iniciar(async () => {
      const r = await liberarObraAction(obra.id, t)
      if (r.error) setErro(r.error)
      else router.push('/obras/base')
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
            Ela entrou pelo Field em <b className="text-[#e8eef7]">{br(obra.aprovacao)}</b> e está
            esperando há <b className="text-[#e8eef7]">{obra.dias ?? 0} dias</b>. Definir a obra que
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
                <Campo rotulo="Tipo">{obra.tipo}</Campo>
                <Campo rotulo="Valor">
                  {obra.valor === null ? (
                    <span className="text-[#f05a28]">ainda sem orçamento</span>
                  ) : (
                    moeda(obra.valor)
                  )}
                </Campo>
                <Campo rotulo="Analista">{obra.analista_cliente}</Campo>
                <Campo rotulo="Origem">{obra.origem}</Campo>
                <Campo rotulo="Aprovada em">{br(obra.aprovacao)}</Campo>
              </Campos>
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
                  onChange={(e) => set('duracao')(e.target.value)}
                />
              </CampoTri>

              <div className="flex flex-col gap-2 border-t border-[#1e3a5f] pt-3">
                <Botao type="button" onClick={liberar} disabled={faltam > 0 || pendente}>
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
                {obra.os_aprovada ? (
                  <>
                    Esta obra já tem <b className="text-[#35c98a]">OS aprovada</b> no sistema do
                    cliente. Não precisa de liberação — a OS já é a autorização.
                  </>
                ) : (
                  <>
                    Esta obra <b className="text-[#f05a28]">ainda não tem OS aprovada</b>. Se algum
                    analista da DPSP autorizou começar mesmo assim, registre aqui quem foi e quando.
                    É o que hoje ninguém anota em lugar nenhum — e sem isso a obra vai para campo sem
                    ninguém nomeado que tenha autorizado.
                  </>
                )}
              </p>

              <CampoTri
                n="·"
                rotulo="Liberado por"
                preenchido={!!t.libPor}
                dica="analista da DPSP que deu o OK"
              >
                <select
                  className={INPUT}
                  aria-label="Liberado por"
                  value={t.libPor}
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
                  className={INPUT}
                  aria-label="Data da liberação"
                  value={t.libEm}
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
