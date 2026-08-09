import { createClient } from '@/lib/supabase/server'
import { SISTEMAS } from '@/lib/sistemas'
import { listarUsuariosAction } from '../_actions'
import ContasCard from './_contas'
import AcessosTable from './_table'

export default async function AcessosPage() {
  const usuarios = await listarUsuariosAction()
  if ('error' in usuarios) {
    return <div className="p-8 text-red-300 text-sm">{usuarios.error}</div>
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: acessos } = await supabase
    .from('hub_system_access')
    .select('user_email, system_slug, has_access')

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuários</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          Controle quem entra no hub e o que cada pessoa pode abrir
        </p>
      </div>
      <ContasCard usuarios={usuarios} emailAtual={user?.email ?? ''} />
      <AcessosTable usuarios={usuarios} sistemas={SISTEMAS} acessos={acessos ?? []} />
    </div>
  )
}
