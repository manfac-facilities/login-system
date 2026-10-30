import { Pill } from '../../_ui/primitivos'
import type { Sinal } from '../_lib/cronograma'

const ROTULO: Record<Sinal, string> = { verde: 'No prazo', amarelo: 'Atenção', vermelho: 'Atrasado' }
const COR: Record<Sinal, string> = { verde: '#22c55e', amarelo: '#eab308', vermelho: '#ef4444' }

export const rotuloSinal = (s: Sinal) => ROTULO[s]
export const corSinal = (s: Sinal) => COR[s]

/** Selo do sinal da obra; sem sinal = obra sem cronograma. */
export default function SeloSinal({ sinal }: { sinal: Sinal | null }) {
  if (!sinal) return <Pill>Sem cronograma</Pill>
  return <Pill cor={COR[sinal]}>{ROTULO[sinal]}</Pill>
}
