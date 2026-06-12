import Logo from '@/components/ui/Logo'
import SignupForm from './SignupForm'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Criar conta</h1>
            <p className="text-[#94a3b8] mt-1 text-sm">
              Acesso restrito a colaboradores @manfac.com.br
            </p>
          </div>
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <SignupForm />
        </div>
      </div>
    </main>
  )
}
