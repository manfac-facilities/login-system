import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import Destinatarios from './_destinatarios'
import ConfigObraForm from './_config'
import PesoAvancoForm from './_peso'
import FeriadosObra from './_feriados'
import DocumentosObra from './_documentos'
import ObraMaeForm from './_obra-mae'
import type { DocumentoLinha } from './_tipos-portal'
import { opcoesObraMae, type AbrangenciaFeriado, type Destinatario, type FeriadoObra, type Lado, type ObraParaMae, type PesoAvanco, type TipoEnvio } from './_tipos'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email
  // Só administrador: falha fechada.
  if (!email || !(await isAdmin(supabase, email))) {
    return <EstadoVazio>Só administrador acessa as configurações da obra</EstadoVazio>
  }

  const [obraR, destR, ferR, v1R, docR, obrasR] = await Promise.all([
    supabase.from('obras_obra').select('engenheiro_email, data_base, atividade_trava, peso_avanco').eq('id', id).maybeSingle(),
    supabase.from('obras_destinatario').select('id, email, nome, funcao, lado, tipos, ativo').eq('obra_id', id).order('email'),
    supabase
      .from('obras_feriado')
      .select('data, descricao, abrangencia, obra_id')
      .or(`obra_id.is.null,obra_id.eq.${id}`)
      .order('data'),
    supabase.from('obras_cronograma_versao').select('salva_em').eq('obra_id', id).eq('numero', 1).maybeSingle(),
    supabase
      .from('obras_documento')
      .select('id, pasta, nome, tamanho, criado_em, criado_por')
      .eq('obra_id', id)
      .order('criado_em', { ascending: false }),
    // OS filha: consulta separada — se falhar (ex.: coluna obra_pai_id ainda não aplicada), só o bloco some.
    supabase.from('obras_obra').select('id, os, loja, obra_pai_id').eq('modalidade', 'obra').is('cancelado_em', null),
  ])
  if (obraR.error || destR.error || ferR.error || docR.error) {
    return <EstadoVazio>Não foi possível carregar as configurações desta obra</EstadoVazio>
  }

  const obra = obraR.data
  const destinatarios: Destinatario[] = (destR.data ?? []).map((d) => ({
    id: d.id as string,
    email: d.email as string,
    nome: (d.nome as string | null) ?? null,
    funcao: (d.funcao as string | null) ?? null,
    lado: ((d.lado as Lado | null) ?? 'cliente') as Lado,
    tipos: (d.tipos ?? []) as TipoEnvio[],
    ativo: d.ativo !== false,
  }))
  const documentos: DocumentoLinha[] = (docR.data ?? []).map((d) => ({
    id: d.id as string,
    pasta: d.pasta as string,
    nome: d.nome as string,
    tamanho: (d.tamanho as number | null) ?? null,
    criadoEm: d.criado_em as string,
    criadoPor: (d.criado_por as string | null) ?? null,
  }))
  const feriados: FeriadoObra[] = (ferR.data ?? []).map((f) => ({
    data: f.data as string,
    descricao: f.descricao as string,
    abrangencia: f.abrangencia as AbrangenciaFeriado,
    global: f.obra_id == null,
  }))

  const obrasMae: ObraParaMae[] | null = obrasR.error
    ? null
    : ((obrasR.data ?? []) as { id: string; os: string | null; loja: string | null; obra_pai_id: string | null }[]).map((o) => ({
        id: o.id, os: o.os, loja: o.loja, paiId: o.obra_pai_id,
      }))
  const maeAtual = obrasMae?.find((o) => o.id === id)?.paiId ?? null
  const mae = obrasMae ? opcoesObraMae(obrasMae, id) : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        {/* Destinatários do cliente e acesso ao portal: no organograma de Dados da obra (Fases B/C §2.2). */}
        <section aria-label="Cliente" className="flex flex-col gap-2 rounded-xl border border-[#dadad8] bg-white p-3 text-sm text-[#333336]">
          <h2 className="text-lg font-bold text-[#00345e]">Envios ao cliente e acesso ao portal</h2>
          <p>
            Quem do cliente recebe o diário, o semanal e o mensal, e quem entra na página do cliente, agora se marca no organograma, em Dados da obra.
          </p>
          <Link href={`/obras/obras/${id}/dados`} className="inline-flex min-h-11 items-center self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white">
            Abrir Dados da obra
          </Link>
        </section>
        <Destinatarios obraId={id} itens={destinatarios} admin soInterno />
        <FeriadosObra obraId={id} feriados={feriados} />
        <DocumentosObra obraId={id} itens={documentos} pode />
      </div>
      <div className="flex flex-col gap-6">
        <ConfigObraForm
          obraId={id}
          admin
          baseSalva={!!v1R.data?.salva_em}
          inicial={{
            engenheiroEmail: obra?.engenheiro_email ?? null,
            dataBase: obra?.data_base ?? null,
            atividadeTrava: obra?.atividade_trava ?? null,
          }}
        />
        <PesoAvancoForm obraId={id} inicial={(obra?.peso_avanco ?? null) as PesoAvanco} />
        {obrasMae && mae ? (
          <ObraMaeForm
            obraId={id}
            maeAtual={maeAtual}
            opcoes={mae.opcoes}
            bloqueio={mae.bloqueio}
            filhas={obrasMae.filter((o) => o.paiId === id)}
          />
        ) : null}
      </div>
    </div>
  )
}
