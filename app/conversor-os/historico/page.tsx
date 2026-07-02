import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admins'
import HistoricoTable from './_table'

export default async function HistoricoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = isAdminEmail(user?.email ?? '')
  let query = supabase
    .from('conversor_os_imports')
    .select('id, cliente, filename, storage_path, user_email, total_rows, converted_rows, duplicates_removed, imported_at')
    .order('imported_at', { ascending: false })
  if (!admin) query = query.eq('user_email', user?.email ?? '')

  const { data } = await query

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Histórico de Importações</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        {admin ? 'Todas as conversões realizadas no hub' : 'Suas conversões'}
      </p>
      <HistoricoTable importacoes={data ?? []} mostrarUsuario={admin} />
    </div>
  )
}
