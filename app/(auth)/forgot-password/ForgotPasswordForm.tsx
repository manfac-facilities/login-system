'use client'

import { useActionState } from 'react'
import { forgotPasswordAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FormError from '@/components/ui/FormError'
import Link from 'next/link'

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, {})

  if (state?.success) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">📬</div>
        <p className="text-white font-semibold mb-2">E-mail enviado!</p>
        <p className="text-[#94a3b8] text-sm mb-6">
          Verifique sua caixa de entrada e siga o link para redefinir sua senha.
        </p>
        <Link href="/login" className="text-[#f05a28] hover:underline text-sm">
          ← Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state?.error} />

      <Input
        label="E-mail corporativo"
        name="email"
        type="email"
        placeholder="voce@manfac.com.br"
        required
        autoComplete="email"
      />

      <Button type="submit" loading={isPending}>
        Enviar link de redefinição →
      </Button>

      <p className="text-center text-sm text-[#94a3b8]">
        <Link href="/login" className="text-[#f05a28] hover:underline">
          ← Voltar ao login
        </Link>
      </p>
    </form>
  )
}
