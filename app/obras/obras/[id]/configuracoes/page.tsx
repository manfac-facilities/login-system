import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import Destinatarios from './_destinatarios'
import ConfigObraForm from './_config'
import PesoAvancoForm from './_peso'
import FeriadosObra from './_feriados'
import type { AbrangenciaFeriado, Destinatario, FeriadoObra, Lado, PesoAvanco, TipoEnvio } from './_tipos'

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

  const [obraR, destR, ferR, v1R] = await Promise.all([
    supabase.from('obras_obra').select('engenheiro_email, data_base, atividade_trava, peso_avanco').eq('id', id).maybeSingle(),
    supabase.from('obras_destinatario').select('id, email, nome, funcao, lado, tipos, ativo').eq('obra_id', id).order('email'),
    supabase
      .from('obras_feriado')
      .select('data, descricao, abrangencia, obra_id')
      .or(`obra_id.is.null,obra_id.eq.${id}`)
      .order('data'),
    supabase.from('obras_cronograma_versao').select('salva_em').eq('obra_id', id).eq('numero', 1).maybeSingle(),
  ])
  if (obraR.error || destR.error || ferR.error) {
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
  const feriados: FeriadoObra[] = (ferR.data ?? []).map((f) => ({
    data: f.data as string,
    descricao: f.descricao as string,
    abrangencia: f.abrangencia as AbrangenciaFeriado,
    global: f.obra_id == null,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <Destinatarios obraId={id} itens={destinatarios} admin />
        <FeriadosObra obraId={id} feriados={feriados} />
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
      </div>
    </div>
  )
}
