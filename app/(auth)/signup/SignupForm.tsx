'use client'

import { useActionState } from 'react'
import { signupAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FormError from '@/components/ui/FormError'
import Link from 'next/link'

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state?.error} />

      <Input
        label="Nome completo"
        name="fullName"
        type="text"
        placeholder="João Victor Costa"
        required
        autoComplete="name"
      />
      <Input
        label="E-mail corporativo"
        name="email"
        type="email"
        placeholder="voce@manfac.com.br"
        required
        autoComplete="email"
      />
      <Input
        label="Senha"
        name="password"
        type="password"
        placeholder="Mínimo 8 caracteres"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        placeholder="Repita a senha"
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={isPending}>
        Criar conta →
      </Button>

      <p className="text-center text-sm text-[#94a3b8]">
        Já tenho conta{' '}
        <Link href="/login" className="text-[#f05a28] hover:underline">
          ← Fazer login
        </Link>
      </p>
    </form>
  )
}
