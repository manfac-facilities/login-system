/**
 * Mapa da obra no portal do cliente (Leva 6, spec §2.8). Cliente admin, SEMPRE
 * pelo id que a guarda (`exigirObra`) já autorizou.
 *
 * Lado cliente (as mesmas regras do resto do portal):
 * - fotos só de diário validado/enviado (filtro no banco E aqui), caminho
 *   canônico da obra, URL assinada curta gerada no servidor;
 * - impedimento (▲ e descrição) só aberto e com `exibir_ao_cliente`;
 * - atividade pelo código exibido e pela situação do cronograma do portal
 *   (nunca o `numero` interno, nunca R$/peso); sem versão salva, sem atividade;
 * - ponto de foto só pelo número (o nome é interno).
 */
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { codigosDeAtividades } from '@/app/obras/obras/_lib/cronograma'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { lerFotosDoMapa, lerMapa, type ModoMapa } from '@/app/obras/obras/_lib/mapa-leitura'
import { caminhoFotoValido } from '@/app/obras/obras/_pdf/fotos-periodo'
import { FOTOS_POR_AMBIENTE, montarMapaTela } from '@/app/obras/obras/[id]/mapa/_dados'
import { caminhoPlantaValido } from '@/app/obras/obras/[id]/mapa/_regras'
import type { AtividadeCliente, VisaoCliente } from './visao'
import { obraTemFaseamento } from './faseamento'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const VALIDADE_URL_MAPA_S = 300
const VALIDO = new Set(['validado', 'enviado'])

export type AmbienteCliente = {
  id: string
  nome: string
  areaM2: number | null
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  pct: number | null
  previsto: number | null
  faixa: 0 | 1 | 2 | 3 | 4 | null
  atividades: Pick<AtividadeCliente, 'codigo' | 'descricao' | 'situacao' | 'tom' | 'realizado'>[]
  impedimentos: { id: string; descricao: string }[]
  fotos: { id: string; url: string; data: string; pontoNumero: number | null }[]
}

export type MapaCliente = {
  /** false = obra sem cronograma salvo: nenhum avanço por atividade ainda. */
  cronogramaPublicado: boolean
  /** Planta sem URL (caminho inválido/assinatura falhou) cai no croqui. */
  modo: ModoMapa
  plantaUrl: string | null
  plantaLargura: number | null
  plantaAltura: number | null
  ambientes: AmbienteCliente[]
  pontos: { id: string; numero: number; x: number | null; y: number | null }[]
}

/**
 * A aba Mapa aparece? Com ≥ 1 ambiente OU com faseamento emitido (a aba pode ter só a seção Faseamento).
 * Erro de leitura de uma das fontes não esconde a outra.
 */
export const obraTemMapa = cache(async (obraId: string): Promise<boolean> => {
  const [amb, fase] = await Promise.all([
    createAdminClient().from('obras_ambiente').select('id').eq('obra_id', obraId).limit(1),
    obraTemFaseamento(obraId),
  ])
  return (!amb.error && (amb.data ?? []).length > 0) || fase
})

/** null = obra sem mapa (a página dá 404). Lança em falha de leitura. */
export async function lerMapaDoPortal(admin: Admin, obraId: string, og: ObraGrande, visao: VisaoCliente): Promise<MapaCliente | null> {
  const m = await lerMapa(admin, obraId)
  if (!m.ok) throw new Error('portal-obra: falha ao ler o mapa')
  const mapa = m.dados
  if (!mapa.ambientes.length) return null

  const [fRs, iR] = await Promise.all([
    Promise.all(
      mapa.ambientes.map((a) => lerFotosDoMapa(admin, obraId, { ambienteId: a.id, estados: ['validado', 'enviado'], limite: FOTOS_POR_AMBIENTE })),
    ),
    admin
      .from('obras_impedimento')
      .select('id, obra_id, ambiente_id, descricao, categoria, exibir_ao_cliente, encerrado_em')
      .eq('obra_id', obraId)
      .eq('categoria', 'impedimento')
      .eq('exibir_ao_cliente', true)
      .is('encerrado_em', null)
      .not('ambiente_id', 'is', null),
  ])
  if (fRs.some((r) => !r.ok) || iR.error) throw new Error('portal-obra: falha ao ler o mapa')
  const fotos = fRs
    .flatMap((r) => (r.ok ? r.fotos : []))
    .filter((f) => VALIDO.has(f.estado) && caminhoFotoValido(obraId, f.data, f.path))
  const impedimentos = ((iR.data ?? []) as Linha[])
    .filter((i) => i.obra_id === obraId && i.categoria === 'impedimento' && i.exibir_ao_cliente === true && !i.encerrado_em && i.ambiente_id)
    .map((i) => ({ id: String(i.id), ambienteId: String(i.ambiente_id), descricao: String(i.descricao ?? '') }))

  const storage = admin.storage.from('obras-fotos')
  const urls = new Map<string, string>()
  if (fotos.length) {
    const { data, error } = await storage.createSignedUrls(fotos.map((f) => f.path), VALIDADE_URL_MAPA_S)
    if (!error) for (const s of (data ?? []) as Linha[]) if (s.path && s.signedUrl && !s.error) urls.set(String(s.path), String(s.signedUrl))
  }
  let plantaUrl: string | null = null
  const plantaPath = mapa.mapa.plantaPath
  if (plantaPath && caminhoPlantaValido(obraId, plantaPath)) {
    const { data } = await storage.createSignedUrl(plantaPath, VALIDADE_URL_MAPA_S)
    plantaUrl = data?.signedUrl ?? null
  }

  // Cliente só vê versão salva: sem cronograma no portal, nenhum avanço por ambiente ("—").
  const atividades = visao.cronograma && og.calc ? og.calc.atividades : []
  const tela = montarMapaTela({ mapa, atividades, fotos, impedimentos, urls, plantaUrl })
  const codigos = codigosDeAtividades(atividades, og.feriados)
  // Foto de ponto depois desativado: o número não está mais no mapa, então sai só o ambiente.
  const numerosAtivos = new Set(tela.pontos.map((p) => p.numero))
  const doPortal = new Map((visao.cronograma?.etapas ?? []).flatMap((e) => e.atividades.map((a) => [a.codigo, a] as const)))

  return {
    cronogramaPublicado: atividades.length > 0,
    modo: tela.modo === 'planta' && !plantaUrl ? 'croqui' : tela.modo,
    plantaUrl,
    plantaLargura: tela.plantaLargura,
    plantaAltura: tela.plantaAltura,
    ambientes: tela.ambientes.map((a) => ({
      id: a.id,
      nome: a.nome,
      areaM2: a.areaM2,
      x: a.x,
      y: a.y,
      w: a.w,
      h: a.h,
      pct: a.pct,
      previsto: a.previsto,
      faixa: a.faixa,
      atividades: a.atividades.flatMap((x) => {
        const codigo = codigos.get(x.numero)
        const c = codigo ? doPortal.get(codigo) : undefined
        return c ? [{ codigo: c.codigo, descricao: c.descricao, situacao: c.situacao, tom: c.tom, realizado: c.realizado }] : []
      }),
      impedimentos: a.impedimentos,
      fotos: a.fotos.flatMap((f) => (f.url ? [{ id: f.id, url: f.url, data: f.data, pontoNumero: f.pontoNumero !== null && numerosAtivos.has(f.pontoNumero) ? f.pontoNumero : null }] : [])),
    })),
    pontos: tela.pontos.map((p) => ({ id: p.id, numero: p.numero, x: p.x, y: p.y })),
  }
}
