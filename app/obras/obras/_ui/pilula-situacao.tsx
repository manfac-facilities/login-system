import type { ReactNode } from 'react'
import type { Sinal, Situacao, StatusAtividade } from '../_lib/cronograma'
import {
  IconeAlerta,
  IconeAmpulheta,
  IconeCadeado,
  IconeCheck,
  IconeCirculoTracejado,
  IconePlay,
  IconeRelogio,
} from './icones'
import { TEMA_OBRA as T } from './tema'

/**
 * Pílula de situação da atividade (spec §5). Cor nunca é o único sinal: toda
 * pílula tem rótulo em texto + ícone; "Aguardando cliente" ainda leva hachura.
 *
 * O motor tem `no_prazo` para "nem concluída nem atrasada"; o `status` separa
 * Em andamento de Não iniciada. `bloqueada` (status bloqueado) e a trava ativa
 * aparecem como "Travada".
 */
export type SituacaoExibida =
  | 'concluida'
  | 'em_andamento'
  | 'nao_iniciada'
  | 'atrasada'
  | 'inicio_atrasado'
  | 'aguardando_cliente'
  | 'travada'

export function situacaoExibida(situacao: Situacao, status?: StatusAtividade, travada?: boolean): SituacaoExibida {
  if (situacao === 'concluida') return 'concluida'
  if (situacao === 'bloqueada' || travada) return 'travada'
  if (situacao === 'no_prazo') return status === 'em_andamento' ? 'em_andamento' : 'nao_iniciada'
  return situacao
}

type Estilo = { rotulo: string; texto: string; fundo: string; borda: string; icone: ReactNode; hachura?: boolean }

const I = 13
export const ESTILO_SITUACAO: Record<SituacaoExibida, Estilo> = {
  concluida: { rotulo: 'Concluída', texto: T.verdeTexto, fundo: '#e8f5ee', borda: '#b9e0c9', icone: <IconeCheck tamanho={I} /> },
  em_andamento: { rotulo: 'Em andamento', texto: T.ink, fundo: '#e6eef5', borda: '#b6cadb', icone: <IconePlay tamanho={I} /> },
  nao_iniciada: { rotulo: 'Não iniciada', texto: T.neutroTexto, fundo: '#f1f1ef', borda: T.border, icone: <IconeCirculoTracejado tamanho={I} /> },
  atrasada: { rotulo: 'Atrasada', texto: T.vermelhoTexto, fundo: '#fbecec', borda: '#efc2c2', icone: <IconeAlerta tamanho={I} /> },
  inicio_atrasado: { rotulo: 'Início atrasado', texto: T.yellowTexto, fundo: '#fdf6d8', borda: '#efd77a', icone: <IconeRelogio tamanho={I} /> },
  aguardando_cliente: {
    rotulo: 'Aguardando cliente', texto: T.vermelhoTexto, fundo: '#fdf3f3', borda: '#efc2c2',
    icone: <IconeAmpulheta tamanho={I} />, hachura: true,
  },
  travada: { rotulo: 'Travada', texto: T.neutroTexto, fundo: '#ececea', borda: '#c9c9c6', icone: <IconeCadeado tamanho={I} /> },
}

function Pilula({ e, titulo }: { e: Estilo; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium leading-4' +
        (e.hachura ? ' obra-hachura' : '')
      }
      style={{ color: e.texto, backgroundColor: e.fundo, borderColor: e.borda }}
    >
      {e.icone}
      <span>{e.rotulo}</span>
    </span>
  )
}

export default function PilulaSituacao({
  situacao,
  status,
  travada,
}: {
  situacao: Situacao
  status?: StatusAtividade
  travada?: boolean
}) {
  return <Pilula e={ESTILO_SITUACAO[situacaoExibida(situacao, status, travada)]} />
}

const ESTILO_SINAL: Record<Sinal | 'sem', Estilo> = {
  verde: { ...ESTILO_SITUACAO.concluida, rotulo: 'No prazo' },
  amarelo: { ...ESTILO_SITUACAO.inicio_atrasado, rotulo: 'Atenção', icone: <IconeAlerta tamanho={I} /> },
  vermelho: { ...ESTILO_SITUACAO.atrasada, rotulo: 'Atrasado' },
  sem: { ...ESTILO_SITUACAO.nao_iniciada, rotulo: 'Sem cronograma' },
}

/** Sinal da obra (No prazo / Atenção / Atrasado) no tema claro; null = sem cronograma. */
export function PilulaSinal({ sinal }: { sinal: Sinal | null }) {
  return <Pilula e={ESTILO_SINAL[sinal ?? 'sem']} titulo="Sinal da obra" />
}
