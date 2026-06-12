'use client'

import { useActionState } from 'react'
import { resetPasswordAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FormError from '@/components/ui/FormError'

export default function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state?.error} />

      <Input
        label="Nova senha"
        name="password"
        type="password"
        placeholder="Mínimo 8 caracteres"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirmar nova senha"
        name="confirmPassword"
        type="password"
        placeholder="Repita a nova senha"
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={isPending}>
        Redefinir senha →
      </Button>
    </form>
  )
}
