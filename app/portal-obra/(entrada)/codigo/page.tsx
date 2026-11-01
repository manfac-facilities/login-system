import Link from 'next/link'
import { MENSAGEM_UNIFORME } from '@/lib/portal-obra/acesso'
import { FormCodigo } from '../_form'

export default function CodigoPortal() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900">Digite o código</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">{MENSAGEM_UNIFORME} Ele vale por 10 minutos.</p>
        <FormCodigo />
        <Link href="/portal-obra" className="mt-6 inline-flex min-h-[44px] items-center text-sm font-medium text-[#c2410c] underline">
          Pedir outro código ou usar outro e-mail
        </Link>
      </div>
    </main>
  )
}
