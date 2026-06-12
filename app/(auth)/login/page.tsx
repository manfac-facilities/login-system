import { cookies } from 'next/headers'
import Logo from '@/components/ui/Logo'
import LoginForm from './LoginForm'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies()
  const userName = cookieStore.get('manfac_user_name')?.value
  const userEmail = cookieStore.get('manfac_user_email')?.value
  const { error } = await searchParams

  const greeting = userName
    ? `Olá, ${userName}! Digite sua senha para continuar.`
    : 'Bem-vindo de volta'

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" priority />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{greeting}</h1>
            {!userName && (
              <p className="text-[#94a3b8] mt-1 text-sm">
                Acesso restrito a colaboradores Manfac
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <LoginForm urlError={error} defaultEmail={userEmail} />
        </div>

        <p className="text-center text-xs text-[#4a6080] mt-6">
          Manfac Facilities v1.0 · Sistema online
        </p>
      </div>
    </main>
  )
}
