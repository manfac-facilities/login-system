/**
 * Monta o que a tela do mapa recebe (puro, testável): avanço e previsto por
 * ambiente (`avancoDoAmbiente`, só versão vigente), faixa de cor, atividades
 * ligadas, impedimentos abertos e fotos recentes. Nada de peso nem valor vai
 * ao navegador.
 */
import type { AtividadeCalculada } from '../../_lib/cronograma'
import { avancoDoAmbiente, faixaDeCor, type FotoMapa } from '../../_lib/mapa'
import type { MapaDaObra } from '../../_lib/mapa-leitura'
import type { MapaTela } from './_tipos'

export const FOTOS_POR_AMBIENTE = 6

/** Ambiente da foto: o dela ou, foto antiga só com ponto, o do ponto. */
export function ambienteDaFoto(f: FotoMapa, pontoAmbiente: Map<string, string>): string | null {
  return f.ambienteId ?? (f.pontoId ? pontoAmbiente.get(f.pontoId) ?? null : null)
}

/** Fotos mais recentes por ambiente (data do RDO desc, depois ordem desc). */
export function fotosRecentesPorAmbiente(mapa: MapaDaObra, fotos: FotoMapa[], n = FOTOS_POR_AMBIENTE): Map<string, FotoMapa[]> {
  const pontoAmbiente = new Map(mapa.pontos.map((p) => [p.id, p.ambienteId]))
  const ordenadas = [...fotos].sort((a, b) => (a.data === b.data ? b.ordem - a.ordem : a.data < b.data ? 1 : -1))
  const r = new Map<string, FotoMapa[]>()
  for (const f of ordenadas) {
    const amb = ambienteDaFoto(f, pontoAmbiente)
    if (!amb) continue
    const l = r.get(amb) ?? []
    if (l.length < n) l.push(f)
    r.set(amb, l)
  }
  return r
}

export function montarMapaTela(p: {
  mapa: MapaDaObra
  atividades: AtividadeCalculada[]
  fotos: FotoMapa[]
  /** Impedimentos ABERTOS com ambiente. */
  impedimentos: { id: string; ambienteId: string; descricao: string }[]
  urls: Map<string, string>
  plantaUrl: string | null
}): MapaTela {
  const { mapa, atividades } = p
  const previstas = atividades.map((a) => ({ ...a, percentual: a.percentualPrevisto }))
  const porNumero = new Map(atividades.map((a) => [a.numero, a]))
  const numeroDoPonto = new Map(mapa.pontos.map((x) => [x.id, x.numero]))
  const recentes = fotosRecentesPorAmbiente(mapa, p.fotos)
  const ativos = mapa.pontos.filter((x) => x.ativo)

  return {
    modo: mapa.mapa.modo,
    plantaUrl: p.plantaUrl,
    plantaLargura: mapa.mapa.plantaLargura,
    plantaAltura: mapa.mapa.plantaAltura,
    ambientes: mapa.ambientes.map((a) => {
      const pct = avancoDoAmbiente(a.id, mapa.vinculos, atividades)
      const numeros = [...new Set(mapa.vinculos.filter((v) => v.ambienteId === a.id).map((v) => v.atividadeNumero))].sort((x, y) => x - y)
      return {
        id: a.id,
        nome: a.nome,
        areaM2: a.areaM2,
        x: a.x,
        y: a.y,
        w: a.w,
        h: a.h,
        pct,
        previsto: avancoDoAmbiente(a.id, mapa.vinculos, previstas),
        faixa: faixaDeCor(pct),
        // Atividade fora da versão vigente não aparece (e não entra no avanço).
        atividades: numeros.flatMap((n) => {
          const c = porNumero.get(n)
          if (!c) return []
          const pctA = Number.isFinite(c.percentual) ? c.percentual : 0
          return [{
            numero: n,
            descricao: c.descricao,
            pct: pctA,
            atrasada: c.situacao === 'atrasada' || c.situacao === 'inicio_atrasado',
            concluida: c.situacao === 'concluida' || pctA >= 1,
          }]
        }),
        impedimentos: p.impedimentos.filter((i) => i.ambienteId === a.id).map((i) => ({ id: i.id, descricao: i.descricao })),
        fotos: (recentes.get(a.id) ?? []).map((f) => ({
          id: f.id,
          url: p.urls.get(f.path) ?? null,
          data: f.data,
          pontoNumero: f.pontoId ? numeroDoPonto.get(f.pontoId) ?? null : null,
        })),
      }
    }),
    pontos: ativos.map((x) => ({ id: x.id, numero: x.numero, nome: x.nome, ambienteId: x.ambienteId, x: x.x, y: x.y })),
  }
}
