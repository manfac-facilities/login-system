'use server'

import { createClient } from '@/lib/supabase/server'
import { isManfacEmail } from '@/lib/auth/domain'
import { redirect } from 'next/navigation'

type SignupState = { error?: string }

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const fullName = (formData.get('fullName') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!isManfacEmail(email)) {
    return { error: 'O e-mail deve ser do domínio @manfac.com.br' }
  }

  if (password.length < 8) {
    return { error: 'A senha deve ter no mínimo 8 caracteres' }
  }

  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Este e-mail já está cadastrado. Faça login.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect('/signup/verify')
}
