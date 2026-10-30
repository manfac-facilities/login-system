/**
 * Lê do banco o que o PDF do diário precisa (spec Leva 2 §6.1-5): gerado na
 * hora a partir do RDO validado/enviado (conteúdo imutável pelo banco) e dos
 * impedimentos/orientações daquela data. Sem guardar cópia.
 *
 * Quem chama já conferiu a sessão e o acesso (`obras` ou admin). As leituras
 * usam o cliente da sessão (RLS vale); só as fotos saem com a service role,
 * como no e-mail.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { diasUteisEntre } from '../_lib/calendario'
import type { CausaRdo, ClimaRdo, RdoCompleto } from '../_lib/email-diario'
import { lerObraGrande } from '../_lib/leitura'
import { logoManfac } from './base'
import { montarDadosPdfRdo, type DadosPdfRdo, type FotoPdf } from './rdo'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ISO = /^\d{4}-\d{2}-\d{2}$/
const CAUSAS: CausaRdo[] = ['cliente', 'material', 'equipe', 'clima', 'projeto', 'outro']
/** Mesmos limites do e-mail (`validarEEnviarAction`). */
export const MAX_FOTOS_PDF = 6
export const MAX_BYTES_FOTO_PDF = 1_500_000

export type PdfRdoCarregado =
  | { ok: true; dados: DadosPdfRdo; nomeArquivo: string }
  | { ok: false; status: 404 | 500; erro: string }

const nao = (erro: string): PdfRdoCarregado => ({ ok: false, status: 404, erro })

/** JPEG ou PNG pelo cabeçalho do arquivo; outro formato o react-pdf não desenha. */
function formatoDe(b: Buffer): FotoPdf['formato'] | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) return 'png'
  return null
}

const nomeArquivo = (loja: string, data: string) =>
  `diario-${
    loja
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'obra'
  }-${data}.pdf`

export async function carregarPdfRdo(
  supabase: SupabaseClient,
  obraId: string,
  data: string,
  agora: Date = new Date(),
): Promise<PdfRdoCarregado> {
  if (!ISO.test(data)) return nao('Data inválida')

  const lida = await lerObraGrande(supabase, obraId, data)
  if (!lida.ok) return nao(lida.erro)
  const og = lida.dados
  if (og.obra.modalidade !== 'obra') return nao('Obra não encontrada')

  const { data: rdoL, error: errR } = await supabase
    .from('obras_rdo')
    .select('*')
    .eq('obra_id', obraId)
    .eq('data', data)
    .maybeSingle()
  if (errR) return { ok: false, status: 500, erro: 'Não deu para ler o diário' }
  const rdo = rdoL as Linha | null
  // Rascunho nunca vira PDF: o cliente só vê o que foi validado.
  if (!rdo || (rdo.estado !== 'validado' && rdo.estado !== 'enviado')) return nao('Diário não validado')

  const [avR, foR] = await Promise.all([
    supabase.from('obras_rdo_avanco').select('*').eq('rdo_id', rdo.id),
    supabase.from('obras_rdo_foto').select('*').eq('rdo_id', rdo.id).order('ordem'),
  ])
  if (avR.error || foR.error) return { ok: false, status: 500, erro: 'Não deu para ler o diário' }

  const rdoCompleto: RdoCompleto = {
    id: String(rdo.id),
    data,
    semExecucao: !!rdo.sem_execucao,
    motivoSemExecucao: (rdo.motivo_sem_execucao as string | null) ?? null,
    programacaoAmanha: (rdo.programacao_amanha as string | null) ?? null,
    clima: (rdo.clima as ClimaRdo | null) ?? null,
    climaManha: (rdo.clima_manha as ClimaRdo | null) ?? null,
    climaTarde: (rdo.clima_tarde as ClimaRdo | null) ?? null,
    avancos: ((avR.data ?? []) as Linha[]).map((a) => ({
      numero: Number(a.numero),
      de: Number(a.de ?? 0),
      para: Number(a.para ?? 0),
      concluida: !!a.concluida,
      causa: CAUSAS.includes(a.causa) ? (a.causa as CausaRdo) : null,
    })),
  }

  // Fotos: só caminho canônico deste RDO, até 6, cada uma até 1,5 MB (como no e-mail).
  const prefixo = `${obraId}/rdo/${data}/`
  const linhasFoto = ((foR.data ?? []) as Linha[]).slice(0, MAX_FOTOS_PDF)
  const fotos: FotoPdf[] = []
  let fotosOmitidas = 0
  if (linhasFoto.length) {
    const bucket = createAdminClient().storage.from('obras-fotos')
    for (const f of linhasFoto) {
      const path = String(f.path ?? '')
      const valido = path.startsWith(prefixo) && !path.split('/').includes('..')
      const { data: blob, error } = valido ? await bucket.download(path) : { data: null, error: null }
      const dados = blob && !error ? Buffer.from(await blob.arrayBuffer()) : null
      const formato = dados && dados.length <= MAX_BYTES_FOTO_PDF ? formatoDe(dados) : null
      if (!dados || !formato) {
        console.warn(`[pdf-diario] foto omitida ${path}: ${error?.message ?? `${dados?.length ?? 0} bytes`}`)
        fotosOmitidas++
        continue
      }
      fotos.push({ dados, formato, legenda: (f.legenda as string | null) ?? null })
    }
  }

  const dados = montarDadosPdfRdo({
    obra: og,
    rdo: rdoCompleto,
    equipe: {
      efetivo: rdo.efetivo === null || rdo.efetivo === undefined ? null : Number(rdo.efetivo),
      texto: (rdo.equipe_texto as string | null) ?? null,
    },
    validadoPor: (rdo.validado_por as string | null) ?? '—',
    validadoEm: (rdo.validado_em as string | null) ?? agora.toISOString(),
    diaN: diasUteisEntre(og.obra.data_base ?? data, data, og.feriados),
    fotos,
    fotosOmitidas,
    geradoEm: agora.toISOString(),
    logo: logoManfac(),
  })
  return { ok: true, dados, nomeArquivo: nomeArquivo(dados.conteudo.loja, data) }
}
