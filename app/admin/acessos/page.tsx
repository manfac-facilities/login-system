import { createClient } from '@/lib/supabase/server'
import { listarUsuariosAction } from '../_actions'
import AcessosTable from './_table'

const SISTEMAS = [{ slug: 'conversor-os', label: 'Conversor OS' }]

export default async function AcessosPage() {
  const usuarios = await listarUsuariosAction()
  if ('error' in usuarios) {
    return <div className="p-8 text-red-300 text-sm">{usuarios.error}</div>
  }

  const supabase = await createClient()
  const { data: acessos } = await supabase
    .from('hub_system_access')
    .select('user_email, system_slug, has_access')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Gestão de Acessos</h1>
      <p className="text-[#4a6080] text-sm mb-8">Controle quais usuários acessam cada sistema do hub</p>
      <AcessosTable usuarios={usuarios} sistemas={SISTEMAS} acessos={acessos ?? []} />
    </div>
  )
}
