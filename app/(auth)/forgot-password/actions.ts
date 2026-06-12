'use server'

import { createClient } from '@/lib/supabase/server'
import { isManfacEmail } from '@/lib/auth/domain'

type ForgotState = { error?: string; success?: boolean }

export async function forgotPasswordAction(
  _prevState: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = (formData.get('email') as string).trim()

  if (!isManfacEmail(email)) {
    return { error: 'O e-mail deve ser do domínio @manfac.com.br' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: 'Erro ao enviar e-mail. Tente novamente.' }
  }

  return { success: true }
}
