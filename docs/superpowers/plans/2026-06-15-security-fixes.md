# Security Fixes — Manfac Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 7 vulnerabilidades de segurança identificadas em code review do sistema de login Manfac.

**Architecture:** Todas as correções são cirúrgicas — sem refatorações estruturais. Cada task corrige um problema isolado e é commitada individualmente. A ordem importa: Task 1 (domain) deve vir antes das tasks que dependem de `isManfacEmail`.

**Tech Stack:** Next.js 16 App Router, Supabase Auth, TypeScript. Testes com Jest (`npm test`).

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `lib/auth/domain.ts` | Fix double-at bypass em `isManfacEmail` |
| `lib/auth/__tests__/domain.test.ts` | Adicionar teste de regressão |
| `app/auth/callback/route.ts` | Validar parâmetro `next` + setar cookie de reset |
| `middleware.ts` | Fix signOut, importar `isManfacEmail`, remover `/reset-password` de `isAuthPage` |
| `app/(auth)/reset-password/actions.ts` | Verificar cookie de reset antes de `updateUser` |
| `app/(auth)/signup/actions.ts` | Neutralizar enumeração de e-mails |
| `next.config.ts` | Remover `unsafe-eval` do CSP |

---

## Task 1 — Fix `isManfacEmail` double-at bypass

**Problema:** `endsWith('@manfac.com.br')` aceita `atacante@evil.com@manfac.com.br`.  
**Fix:** Verificar que o e-mail tem exatamente um `@`.

**Files:**
- Modify: `lib/auth/domain.ts`
- Modify: `lib/auth/__tests__/domain.test.ts`

- [ ] **Step 1: Adicionar teste de regressão**

Em `lib/auth/__tests__/domain.test.ts`, adicionar dentro do `describe('isManfacEmail')`:

```typescript
  it('rejects double-at email bypass', () => {
    expect(isManfacEmail('atacante@evil.com@manfac.com.br')).toBe(false)
  })
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
npm test -- --testPathPattern=domain
```
Esperado: FAIL — `Expected: false, Received: true`

- [ ] **Step 3: Corrigir `isManfacEmail` em `lib/auth/domain.ts`**

Substituir o conteúdo do arquivo por:

```typescript
const ALLOWED_DOMAIN = '@manfac.com.br'

export function isManfacEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const atCount = normalized.split('@').length - 1
  return atCount === 1 && normalized.endsWith(ALLOWED_DOMAIN)
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}
```

- [ ] **Step 4: Rodar todos os testes**

```bash
npm test
```
Esperado: PASS (todos os 10 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/domain.ts lib/auth/__tests__/domain.test.ts
git commit -m "fix: reject double-at email bypass in isManfacEmail"
```

---

## Task 2 — Fix open redirect em `/auth/callback`

**Problema 1:** O parâmetro `next` da URL é usado diretamente no redirect sem validação — permite redirecionar para domínios externos.  
**Problema 2:** Quando o callback redireciona para `/reset-password`, o middleware bloqueia essa navegação (redireciona para `/dashboard`) por `/reset-password` estar em `isAuthPage`. A solução é setar um cookie de reset que o flow de reset vai consumir.  
**Fix:** Validar que `next` é um caminho relativo interno + setar cookie `manfac_reset_pending` quando `next=/reset-password`.

**Files:**
- Modify: `app/auth/callback/route.ts`

- [ ] **Step 1: Reescrever `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function isSafeRedirect(next: string): boolean {
  // Só permite caminhos relativos internos — sem protocolo, sem double-slash
  return next.startsWith('/') && !next.startsWith('//')
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = isSafeRedirect(rawNext) ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (next === '/reset-password') {
        const cookieStore = await cookies()
        cookieStore.set('manfac_reset_pending', '1', {
          maxAge: 300, // 5 minutos para completar o reset
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        })
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_error`)
}
```

- [ ] **Step 2: Verificar que não há erros de TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros

- [ ] **Step 3: Rodar testes**

```bash
npm test
```
Esperado: PASS (9/9 ou 10/10)

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "fix: validate next param in auth callback, add reset cookie"
```

---

## Task 3 — Fix middleware: signOut, isManfacEmail, reset-password

**Problema 1:** `supabase.auth.signOut()` é chamado mas o response com Set-Cookie de limpeza é descartado — sessão persiste no browser.  
**Problema 2:** `ALLOWED_DOMAIN` duplicado — middleware tem sua própria cópia em vez de usar `isManfacEmail`.  
**Problema 3:** `/reset-password` está em `isAuthPage`, o que redireciona usuários autenticados para `/dashboard` — quebra o fluxo de reset.

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Reescrever `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isManfacEmail } from '@/lib/auth/domain'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isDashboard = pathname.startsWith('/dashboard')
  // Nota: /reset-password NÃO entra aqui — usuários autenticados precisam
  // acessá-la durante o fluxo de redefinição de senha.
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  if (isDashboard) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!isManfacEmail(user.email ?? '')) {
      // Sinalizar signOut via cookie de limpeza dentro da response de redirect
      await supabase.auth.signOut()
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'unauthorized')
      // Copiar os cookies de limpeza do signOut para a response de redirect
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
  }

  if (isAuthPage && user && isManfacEmail(user.email ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
    '/signup/verify',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ],
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros

- [ ] **Step 3: Rodar testes**

```bash
npm test
```
Esperado: PASS

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "fix: propagate signOut cookies, use isManfacEmail, remove reset-password from isAuthPage"
```

---

## Task 4 — Fix reset-password: exigir cookie de reset

**Problema:** `resetPasswordAction` chama `updateUser({ password })` sem verificar que o usuário chegou via link de reset — qualquer sessão autenticada pode alterar a senha.  
**Fix:** Verificar e consumir o cookie `manfac_reset_pending` definido pelo callback (Task 2).

**Files:**
- Modify: `app/(auth)/reset-password/actions.ts`

- [ ] **Step 1: Reescrever `app/(auth)/reset-password/actions.ts`**

```typescript
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
      error:
        'Link de redefinição inválido ou expirado. Solicite um novo link.',
    }
  }

  // Consumir o cookie antes de atualizar — impede reuso
  cookieStore.delete('manfac_reset_pending')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'Erro ao redefinir senha. O link pode ter expirado.' }
  }

  redirect('/login')
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros

- [ ] **Step 3: Rodar testes**

```bash
npm test
```
Esperado: PASS

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/reset-password/actions.ts
git commit -m "fix: require reset cookie in resetPasswordAction to prevent unauthorized password changes"
```

---

## Task 5 — Fix CSP: remover `unsafe-eval`

**Problema:** `script-src` inclui `'unsafe-eval'`, o que permite execução de código via `eval()` — elimina a principal proteção do CSP contra XSS.  
**Fix:** Remover `'unsafe-eval'`. O Next.js App Router não precisa de `eval()`. `'unsafe-inline'` permanece pois é necessário para os scripts de hidratação do React.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Remover `'unsafe-eval'` do CSP em `next.config.ts`**

Localizar a linha:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

Substituir por:
```typescript
"script-src 'self' 'unsafe-inline'",
```

- [ ] **Step 2: Testar que o app ainda funciona**

```bash
npm run build
```
Esperado: build completo sem erros

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix: remove unsafe-eval from CSP script-src"
```

---

## Task 6 — Fix enumeração de e-mails no signup

**Problema:** Signup retorna mensagem diferente (`'Este e-mail já está cadastrado. Faça login.'`) para e-mails já cadastrados, permitindo que atacante enumere contas manfac válidas.  
**Fix:** Tratar e-mail já cadastrado como sucesso (redirecionar para `/signup/verify`) — o usuário legítimo receberá um e-mail ou verá a tela de verificação, sem vazar informação de existência de conta.

**Files:**
- Modify: `app/(auth)/signup/actions.ts`

- [ ] **Step 1: Alterar tratamento de e-mail duplicado em `app/(auth)/signup/actions.ts`**

Localizar:
```typescript
  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Este e-mail já está cadastrado. Faça login.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }
```

Substituir por:
```typescript
  if (error) {
    // Não revelar se o e-mail já existe — evitar enumeração de contas
    if (error.message.toLowerCase().includes('already registered')) {
      redirect('/signup/verify')
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros

- [ ] **Step 3: Rodar testes**

```bash
npm test
```
Esperado: PASS

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/signup/actions.ts
git commit -m "fix: redirect to verify on duplicate email to prevent account enumeration"
```

---

## Verificação final

- [ ] **Rodar todos os testes**

```bash
npm test
```
Esperado: todos passando

- [ ] **Build de produção**

```bash
npm run build
```
Esperado: sem erros

- [ ] **Checklist de segurança manual**

| Cenário | Resultado esperado |
|---|---|
| `next=//evil.com` no callback | Redireciona para `/dashboard` |
| `next=https://evil.com` no callback | Redireciona para `/dashboard` |
| E-mail `a@b.com@manfac.com.br` no signup | Erro "domínio @manfac.com.br" |
| POST direto em `/reset-password` sem cookie | Erro "link inválido ou expirado" |
| `eval('alert(1)')` no browser | CSP bloqueia |
| Signup com e-mail já cadastrado | Redireciona para `/signup/verify` |
| Sessão inválida acessa `/dashboard` | Redireciona para `/login` e limpa cookie |

---

## Achados não corrigidos (aceitos)

| # | Achado | Decisão |
|---|---|---|
| httpOnly: false nos cookies | Aceito — cookies usados para personalização client-side (nome do usuário no greeting). Risco mitigado pela remoção de `unsafe-eval` no CSP (Task 5). |
| Rate limiting no login | Aceito — Supabase aplica rate limiting nativo nas chamadas de auth. Não é necessária implementação adicional na server action. |
