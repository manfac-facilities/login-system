/**
 * As etiquetas que a Base e a Ficha compartilham.
 *
 * São a tradução direta de `pill` / `osChip` / `covChip` / `mauChip` /
 * `badgeDias` / `prazoHTML` do mockup (:1851-1900). Os textos são os aprovados
 * pelo cliente (modelo-mockup.md §5) — "OS aprovada", "sem OS aprovada",
 * "Sem cobertura", "Liberado por [nome]", "Mau uso". Não reescrever.
 *
 * Ficam aqui, e não em `_ui/primitivos.tsx`, porque aquele arquivo é da frente
 * A e esta frente não pode editá-lo. Sem estado, sem `'use client'`: servem em
 * Server e Client Component.
 */

import { Pill, TEMA } from '../_ui/primitivos'
import {
  classeDias,
  diasSemOS,
  liberada,
  nomeEtapa,
  posCampo,
  prazoTxt,
  semCobertura,
  type Obra,
} from '../_lib/tipos'
import { COR_ETAPA, COR_PRIORIDADE, temAlertaDeAusenciaField } from './_regras'

/** A pílula da etapa, com a cor da etapa. `pill(mockup:1893)`. */
export function EtiquetaEtapa({ obra }: { obra: Pick<Obra, 'etapa'> }) {
  return <Pill cor={COR_ETAPA[obra.etapa]}>{nomeEtapa(obra.etapa)}</Pill>
}

/** Mau uso é CLASSIFICAÇÃO, não etapa: anda ao lado da pílula, em cinza. */
export function EtiquetaMauUso({ obra }: { obra: Pick<Obra, 'mau_uso'> }) {
  if (!obra.mau_uso) return null
  return <Pill cor={TEMA.secundario}>Mau uso</Pill>
}

/** Alerta conservador: sinaliza e mantém a obra visível para tratamento humano. */
export function EtiquetaAusenciaField({
  obra,
}: {
  obra: Pick<Obra, 'field_ausente_em'>
}) {
  if (!temAlertaDeAusenciaField(obra)) return null
  return <Pill cor="#ff4d6d">Não está mais no Field</Pill>
}

/** `osChip(mockup:1851)`. */
export function EtiquetaOS({ obra }: { obra: Pick<Obra, 'os_aprovada'> }) {
  return obra.os_aprovada ? (
    <Pill cor="#35c98a">OS aprovada</Pill>
  ) : (
    <Pill cor="#ff4d6d">sem OS aprovada</Pill>
  )
}

/**
 * `covChip(mockup:1876)` — a etiqueta de cobertura, ao lado da de OS.
 * "Sem cobertura" é o estado de maior risco da base: nem documento, nem nome.
 */
export function EtiquetaCobertura({
  obra,
}: {
  obra: Pick<Obra, 'os_aprovada' | 'liberado_por' | 'etapa'>
}) {
  if (semCobertura(obra)) return <Pill cor="#ff4d6d">Sem cobertura</Pill>
  if (!obra.os_aprovada && liberada(obra)) {
    return <Pill cor="#f4b73f">{`Liberado por ${obra.liberado_por}`}</Pill>
  }
  return null
}

/**
 * A prioridade definida na triagem. Decisão técnica 5 da spec: o mockup
 * captura e nunca exibe; aqui ela aparece.
 */
export function EtiquetaPrioridade({ obra }: { obra: Pick<Obra, 'prioridade'> }) {
  if (!obra.prioridade) return null
  return <Pill cor={COR_PRIORIDADE[obra.prioridade] ?? TEMA.secundario}>{obra.prioridade}</Pill>
}

/** `badgeDias(mockup:1896)`. Vermelho só para obra crítica — ver `classeDias`. */
export function BadgeDias({ obra, curto = false }: { obra: Obra; curto?: boolean }) {
  const classe = classeDias(obra)
  const cor = classe === 'critico' ? '#ff4d6d' : classe === 'atencao' ? '#f4b73f' : TEMA.secundario
  return (
    <span className="whitespace-nowrap text-xs font-semibold" style={{ color: cor }}>
      {obra.dias ?? '—'}{' '}
      <span className="font-normal text-[10px]">
        {curto ? 'dias' : 'dias desde a aprovação'}
      </span>
    </span>
  )
}

/**
 * `prazoHTML(mockup:1884)` — o que substituiu o "Avanço %".
 * Sem duração planejada a barra não existe e a tela escreve "sem prazo
 * definido", em vez de inventar número.
 */
export function PrazoBarra({ obra }: { obra: Obra }) {
  if (obra.diaDe === null || obra.fracPrazo === null) {
    return <span className="text-xs text-[#64748b]">sem prazo definido</span>
  }
  const frac = Math.min(1, obra.fracPrazo)
  const cor = posCampo(obra) ? '#35c98a' : obra.fracPrazo > 1 ? '#ff4d6d' : '#5aa9f0'
  return (
    <span className="inline-flex min-w-[92px] flex-col gap-1">
      <span className="text-xs whitespace-nowrap text-[#e8eef7]">{prazoTxt(obra)}</span>
      <span className="block h-1 w-full overflow-hidden rounded-full bg-[#1e3a5f]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.round(frac * 100)}%`, backgroundColor: cor }}
        />
      </span>
    </span>
  )
}

/** "há N dias" da OS que não sai. Devolve string vazia quando a OS já saiu. */
export function textoDiasSemOS(obra: Obra): string {
  const d = diasSemOS(obra)
  return d === null ? '' : `há ${d} dias`
}
