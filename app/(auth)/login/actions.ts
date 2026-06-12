'use server'

import { createClient } from '@/lib/supabase/server'
import { isManfacEmail, getFirstName } from '@/lib/auth/domain'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type LoginState = { error?: string }

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  if (!isManfacEmail(email)) {
    return { error: 'O e-mail deve ser do domínio @manfac.com.br' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error:
          'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.',
      }
    }
    return { error: 'E-mail ou senha inválidos' }
  }

  const cookieStore = await cookies()

  const fullName = data.user.user_metadata?.full_name as string | undefined
  if (fullName) {
    cookieStore.set('manfac_user_name', getFirstName(fullName), {
      maxAge: 60 * 60 * 24 * 30, // 30 days (reduced from 1 year)
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  // Also store email for pre-filling the login field on next visit
  cookieStore.set('manfac_user_email', email, {
    maxAge: 60 * 60 * 24 * 30, // 30 days (reduced from 1 year)
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })

  redirect('/dashboard')
}
