'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FormError from '@/components/ui/FormError'
import Link from 'next/link'

interface LoginFormProps {
  urlError?: string
  defaultEmail?: string
}

export default function LoginForm({ urlError, defaultEmail }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, {})

  const errorMessage =
    state?.error ??
    (urlError === 'unauthorized' ? 'Acesso não autorizado' : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={errorMessage} />

      <Input
        label="E-mail"
        name="email"
        type="email"
        placeholder="voce@manfac.com.br"
        defaultValue={defaultEmail}
        required
        autoComplete="email"
      />
      <Input
        label="Senha"
        name="password"
        type="password"
        placeholder="Sua senha"
        required
        autoComplete="current-password"
      />

      <div className="flex justify-end -mt-2">
        <Link
          href="/forgot-password"
          className="text-sm text-[#94a3b8] hover:text-[#f05a28] transition-colors"
        >
          Esqueceu a senha?
        </Link>
      </div>

      <Button type="submit" loading={isPending}>
        Entrar no sistema →
      </Button>

      <p className="text-center text-sm text-[#94a3b8]">
        Não tem conta?{' '}
        <Link href="/signup" className="text-[#f05a28] hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  )
}
