import Sidebar from '@/components/sofia/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OperacoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
