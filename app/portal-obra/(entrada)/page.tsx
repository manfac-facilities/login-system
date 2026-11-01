import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { FormEmail } from './_form'

export default async function EntradaPortal() {
  if (await lerSessao(await cookies())) redirect('/portal-obra/obras')
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900">Acompanhe sua obra</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">Digite o e-mail cadastrado pela Manfac. Enviaremos um código de acesso.</p>
        <FormEmail />
      </div>
    </main>
  )
}
