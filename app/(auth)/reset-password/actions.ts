'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type ResetState = { error?: string }

export async function resetPasswordAction(
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password.length < 8) {
    return { error: 'A senha deve ter no mínimo 8 caracteres' }
  }

  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem' }
  }

  const cookieStore = await cookies()
  const resetPending = cookieStore.get('manfac_reset_pending')

  if (!resetPending?.value) {
    return {
      error: 'Link de redefinição inválido ou expirado. Solicite um novo link.',
    }
  }

  // Consumir o cookie antes de atualizar — impede reuso da mesma sessão
  cookieStore.delete('manfac_reset_pending')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'Erro ao redefinir senha. O link pode ter expirado.' }
  }

  redirect('/login')
}
