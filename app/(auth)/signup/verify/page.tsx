import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <Logo size="lg" priority />
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Verifique seu e-mail
          </h1>
          <p className="text-[#94a3b8] mb-6">
            Enviamos um link de confirmação para o seu e-mail corporativo.
            Clique no link para ativar sua conta e depois faça login.
          </p>
          <Link
            href="/login"
            className="text-sm text-[#f05a28] hover:underline"
          >
            Já confirmei → Fazer login
          </Link>
        </div>
      </div>
    </main>
  )
}
