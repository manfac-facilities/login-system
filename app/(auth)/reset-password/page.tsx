import Logo from '@/components/ui/Logo'
import ResetPasswordForm from './ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" priority />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Nova senha</h1>
            <p className="text-[#94a3b8] mt-1 text-sm">
              Escolha uma senha segura para sua conta
            </p>
          </div>
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  )
}
