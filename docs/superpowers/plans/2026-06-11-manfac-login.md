# Manfac Login System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a production-ready Manfac Facilities login system — signup with email confirmation, login with domain restriction (@manfac.com.br), cookie-based personalization, protected dashboard placeholder, and forgot-password flow — ready for the operational dashboard to be coupled later.

**Architecture:** Next.js 15 App Router with server components and server actions for all auth flows. Supabase Auth manages credentials, sessions, and email confirmation. Route protection runs at the Edge via middleware. Deployed to Vercel with environment variables configured in the dashboard.

**Tech Stack:** Next.js 15, TypeScript, Supabase Auth (`@supabase/ssr`), Tailwind CSS v4, Jest + @testing-library/react, Vercel (deployment)

---

## File Map

| File | Responsibility |
|------|---------------|
| `lib/supabase/client.ts` | Browser Supabase client (client components) |
| `lib/supabase/server.ts` | Server Supabase client (server components + actions) |
| `lib/auth/domain.ts` | Domain validation + name utilities (pure functions) |
| `lib/auth/__tests__/domain.test.ts` | Unit tests for domain utilities |
| `middleware.ts` | Edge route protection + domain enforcement |
| `app/layout.tsx` | Root layout with Inter font and brand metadata |
| `app/globals.css` | Tailwind + Manfac theme CSS variables |
| `app/page.tsx` | Root redirect to /login |
| `public/logo.png` | Manfac logo (colorida, fundo escuro) |
| `public/logo-white.png` | Manfac logo (versão branca) |
| `components/ui/Button.tsx` | Brand-styled submit button |
| `components/ui/Input.tsx` | Labeled input with error state |
| `components/ui/FormError.tsx` | Inline form error banner |
| `components/ui/Logo.tsx` | Logo component with size variants |
| `app/(auth)/signup/page.tsx` | Signup page (Server Component) |
| `app/(auth)/signup/actions.ts` | Signup server action |
| `app/(auth)/signup/SignupForm.tsx` | Signup form (Client Component) |
| `app/(auth)/signup/verify/page.tsx` | Post-signup email verification screen |
| `app/(auth)/login/page.tsx` | Login page — reads cookie for personalization |
| `app/(auth)/login/actions.ts` | Login server action — sets first-name cookie |
| `app/(auth)/login/LoginForm.tsx` | Login form (Client Component) |
| `app/(auth)/forgot-password/page.tsx` | Forgot password page |
| `app/(auth)/forgot-password/actions.ts` | Password reset server action |
| `app/(auth)/forgot-password/ForgotPasswordForm.tsx` | Forgot password form (Client Component) |
| `app/(dashboard)/dashboard/page.tsx` | Protected dashboard placeholder |
| `app/(dashboard)/dashboard/actions.ts` | Logout server action |
| `jest.config.ts` | Jest configuration for Next.js |
| `jest.setup.ts` | Jest DOM matchers setup |

---

### Task 1: Initialize Next.js project and test setup

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json` (via create-next-app)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Run create-next-app in the current directory**

Run from `C:\Users\joao-\projeto-01-elite-da-ia` in PowerShell:
```powershell
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```
When prompted whether to overwrite existing files (`README.md` etc.) — choose **Yes** or skip for each. Do **not** overwrite `docs/` or `material manfac/`.

- [ ] **Step 2: Install Supabase packages**

```powershell
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Install test dependencies**

```powershell
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test scripts to package.json**

In `package.json`, ensure `scripts` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Run test suite to verify setup**

```powershell
npm test -- --passWithNoTests
```
Expected output: `No tests found` or `Test Suites: 0 passed`. No errors about missing config.

- [ ] **Step 8: Initialize git and commit**

```powershell
git init
git add package.json package-lock.json next.config.ts tsconfig.json jest.config.ts jest.setup.ts .gitignore .eslintrc.json
git commit -m "chore: initialize Next.js 15 project with Supabase and test setup"
```

---

### Task 2: Supabase project setup + client files

**Files:**
- Create: `.env.local`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create Supabase project**

Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New Project.
- Name: `manfac-portal`
- Region: South America (São Paulo) — `sa-east-1`
- Wait ~2 minutes for provisioning.

- [ ] **Step 2: Configure Supabase Auth settings**

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000` (update to production URL after deploy)
- **Redirect URLs:** add `http://localhost:3000/**`

In Authentication → Email → Enable "Confirm email" (should be on by default).

- [ ] **Step 3: Get credentials and create .env.local**

In Dashboard → Project Settings → API, copy the Project URL and anon key.

Create `.env.local` at project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your_anon_key
```

Verify `.gitignore` already contains `.env.local` (create-next-app adds it). If not, add it.

- [ ] **Step 4: Create lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Create lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — cookies cannot be mutated here
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Commit**

```powershell
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add Supabase browser and server clients"
```

---

### Task 3: Domain validation utility + unit tests

**Files:**
- Create: `lib/auth/domain.ts`
- Create: `lib/auth/__tests__/domain.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `lib/auth/__tests__/domain.test.ts`:
```typescript
import { isManfacEmail, getFirstName } from '../domain'

describe('isManfacEmail', () => {
  it('accepts valid manfac email', () => {
    expect(isManfacEmail('joao@manfac.com.br')).toBe(true)
  })

  it('rejects non-manfac domain', () => {
    expect(isManfacEmail('joao@gmail.com')).toBe(false)
  })

  it('rejects subdomain that contains manfac.com.br', () => {
    expect(isManfacEmail('joao@sub.manfac.com.br')).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    expect(isManfacEmail('  joao@manfac.com.br  ')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isManfacEmail('JOAO@MANFAC.COM.BR')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isManfacEmail('')).toBe(false)
  })
})

describe('getFirstName', () => {
  it('extracts first word from full name', () => {
    expect(getFirstName('João Victor Costa')).toBe('João')
  })

  it('handles single-word name', () => {
    expect(getFirstName('João')).toBe('João')
  })

  it('trims leading and trailing whitespace', () => {
    expect(getFirstName('  João Victor  ')).toBe('João')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```powershell
npm test -- lib/auth/__tests__/domain.test.ts
```
Expected: FAIL — `Cannot find module '../domain'`

- [ ] **Step 3: Implement lib/auth/domain.ts**

```typescript
const ALLOWED_DOMAIN = '@manfac.com.br'

export function isManfacEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith(ALLOWED_DOMAIN)
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
npm test -- lib/auth/__tests__/domain.test.ts
```
Expected: PASS — 9 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```powershell
git add lib/auth/domain.ts "lib/auth/__tests__/domain.test.ts"
git commit -m "feat: add email domain validation utility with unit tests"
```

---

### Task 4: Middleware — route protection + domain enforcement

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_DOMAIN = '@manfac.com.br'

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
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  if (isDashboard) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!user.email?.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      await supabase.auth.signOut()
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(url)
    }
  }

  if (isAuthPage && user?.email?.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Start dev server to confirm no import errors**

```powershell
npm run dev
```
Open `http://localhost:3000` in browser. Expected: page loads without terminal errors about middleware. Stop server with Ctrl+C.

- [ ] **Step 3: Commit**

```powershell
git add middleware.ts
git commit -m "feat: add edge middleware for route protection and domain enforcement"
```

---

### Task 5: Root layout, global styles, and logo

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `public/logo.png` (copy from material manfac)
- Create: `public/logo-white.png` (copy from material manfac)

- [ ] **Step 1: Copy logos to public folder**

```powershell
Copy-Item "material manfac\logos\Arquivos Logo\Logo PNG\1x\LogoPrincipal1.png" "public\logo.png"
Copy-Item "material manfac\logos\Arquivos Logo\Logo PNG\1x\LogoPrincipal3.png" "public\logo-white.png"
```

- [ ] **Step 2: Replace app/globals.css**

```css
@import "tailwindcss";

:root {
  --background: #0a1628;
  --navy: #0d2050;
  --orange: #f05a28;
  --orange-hover: #d94e22;
  --muted: #94a3b8;
  --muted-dark: #4a6080;
  --border: #1e3a5f;
  --input-bg: #0f1f3d;
  --error: #ef4444;
}

html,
body {
  background-color: var(--background);
  color: #ffffff;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Replace app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Manfac Facilities — Portal',
  description: 'Sistema de operações Manfac Facilities',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Replace app/page.tsx (root redirect)**

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 5: Commit**

```powershell
git add app/layout.tsx app/globals.css app/page.tsx public/logo.png public/logo-white.png
git commit -m "feat: configure root layout, Manfac brand theme, and root redirect"
```

---

### Task 6: Shared UI components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/FormError.tsx`
- Create: `components/ui/Logo.tsx`

- [ ] **Step 1: Create components/ui/Button.tsx**

```tsx
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

export default function Button({
  children,
  loading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all
        bg-[#f05a28] hover:bg-[#d94e22] active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-[#f05a28] focus:ring-offset-2 focus:ring-offset-[#0a1628]
        ${className}`}
      {...props}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
```

- [ ] **Step 2: Create components/ui/Input.tsx**

```tsx
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function Input({
  label,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-[#94a3b8]">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full px-4 py-3 rounded-lg text-white placeholder-[#4a6080]
          bg-[#0f1f3d] border transition-colors
          ${error ? 'border-[#ef4444]' : 'border-[#1e3a5f] focus:border-[#f05a28]'}
          focus:outline-none focus:ring-1 focus:ring-[#f05a28]
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create components/ui/FormError.tsx**

```tsx
export default function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div className="w-full px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">
      {message}
    </div>
  )
}
```

- [ ] **Step 4: Create components/ui/Logo.tsx**

```tsx
import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { width: 120, height: 36 },
  md: { width: 160, height: 48 },
  lg: { width: 200, height: 60 },
}

export default function Logo({ size = 'md' }: LogoProps) {
  const { width, height } = sizes[size]
  return (
    <Image
      src="/logo.png"
      alt="Manfac Facilities"
      width={width}
      height={height}
      priority
    />
  )
}
```

- [ ] **Step 5: Commit**

```powershell
git add components/ui/Button.tsx components/ui/Input.tsx components/ui/FormError.tsx components/ui/Logo.tsx
git commit -m "feat: add shared brand UI components"
```

---

### Task 7: Signup page

**Files:**
- Create: `app/(auth)/signup/actions.ts`
- Create: `app/(auth)/signup/SignupForm.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(auth)/signup/verify/page.tsx`

- [ ] **Step 1: Create app/(auth)/signup/actions.ts**

```typescript
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
```

- [ ] **Step 2: Create app/(auth)/signup/SignupForm.tsx**

```tsx
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
```

- [ ] **Step 3: Create app/(auth)/signup/page.tsx**

```tsx
import Logo from '@/components/ui/Logo'
import SignupForm from './SignupForm'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Criar conta</h1>
            <p className="text-[#94a3b8] mt-1 text-sm">
              Acesso restrito a colaboradores @manfac.com.br
            </p>
          </div>
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <SignupForm />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create app/(auth)/signup/verify/page.tsx**

```tsx
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Verifique seu e-mail
          </h1>
          <p className="text-[#94a3b8] mb-6">
            Enviamos um link de confirmação para o seu e-mail corporativo.
            Clique no link para ativar sua conta e depois faça login.
          </p>
          <Link
            href="/login"
            className="text-sm text-[#f05a28] hover:underline"
          >
            Já confirmei → Fazer login
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```powershell
git add "app/(auth)/signup/"
git commit -m "feat: add signup page with domain validation and email verification screen"
```

---

### Task 8: Login page with cookie personalization

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Create: `app/(auth)/login/LoginForm.tsx`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create app/(auth)/login/actions.ts**

```typescript
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

  const fullName = data.user.user_metadata?.full_name as string | undefined
  if (fullName) {
    const cookieStore = await cookies()
    cookieStore.set('manfac_user_name', getFirstName(fullName), {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Create app/(auth)/login/LoginForm.tsx**

```tsx
'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FormError from '@/components/ui/FormError'
import Link from 'next/link'

interface LoginFormProps {
  urlError?: string
}

export default function LoginForm({ urlError }: LoginFormProps) {
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
```

- [ ] **Step 3: Create app/(auth)/login/page.tsx**

```tsx
import { cookies } from 'next/headers'
import Logo from '@/components/ui/Logo'
import LoginForm from './LoginForm'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies()
  const userName = cookieStore.get('manfac_user_name')?.value
  const { error } = await searchParams

  const greeting = userName
    ? `Olá, ${userName}! Digite sua senha para continuar.`
    : 'Bem-vindo de volta'

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" />
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
          <LoginForm urlError={error} />
        </div>

        <p className="text-center text-xs text-[#4a6080] mt-6">
          Manfac Facilities v1.0 · Sistema online
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Test login flow manually**

```powershell
npm run dev
```
1. Go to `http://localhost:3000` — confirm it redirects to `/login`
2. Try entering `test@gmail.com` — confirm error "O e-mail deve ser do domínio @manfac.com.br"
3. Stop server with Ctrl+C.

- [ ] **Step 5: Commit**

```powershell
git add "app/(auth)/login/"
git commit -m "feat: add login page with cookie-based personalization and error handling"
```

---

### Task 9: Forgot password page

**Files:**
- Create: `app/(auth)/forgot-password/actions.ts`
- Create: `app/(auth)/forgot-password/ForgotPasswordForm.tsx`
- Create: `app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Create app/(auth)/forgot-password/actions.ts**

```typescript
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
```

- [ ] **Step 2: Create app/(auth)/forgot-password/ForgotPasswordForm.tsx**

```tsx
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
```

- [ ] **Step 3: Create app/(auth)/forgot-password/page.tsx**

```tsx
import Logo from '@/components/ui/Logo'
import ForgotPasswordForm from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-8 mb-8">
          <Logo size="lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Redefinir senha</h1>
            <p className="text-[#94a3b8] mt-1 text-sm">
              Enviaremos um link para seu e-mail corporativo
            </p>
          </div>
        </div>

        <div className="bg-[#0d2050] rounded-2xl p-8 border border-[#1e3a5f]">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Add NEXT_PUBLIC_SITE_URL to .env.local**

Open `.env.local` and add:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 5: Commit**

```powershell
git add "app/(auth)/forgot-password/" .env.local
git commit -m "feat: add forgot password page with Supabase reset email flow"
```

---

### Task 10: Protected dashboard placeholder + logout

**Files:**
- Create: `app/(dashboard)/dashboard/actions.ts`
- Create: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create app/(dashboard)/dashboard/actions.ts**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('sb-access-token')
  cookieStore.delete('sb-refresh-token')

  redirect('/login')
}
```

- [ ] **Step 2: Create app/(dashboard)/dashboard/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from './actions'
import Logo from '@/components/ui/Logo'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const fullName = user.user_metadata?.full_name as string | undefined
  const firstName = fullName?.trim().split(/\s+/)[0] ?? 'Colaborador'

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#94a3b8]">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-[#94a3b8] hover:text-white transition-colors px-3 py-1.5 rounded border border-[#1e3a5f] hover:border-[#f05a28]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8">
          Bem-vindo ao painel de operações da Manfac Facilities.
        </p>
        <div className="inline-block px-6 py-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-[#4a6080] text-sm">
          Dashboard operacional — em desenvolvimento
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Test full auth flow manually**

```powershell
npm run dev
```
Run through the complete flow:
1. `http://localhost:3000` → redirects to `/login` ✓
2. Go to `/signup` → create account with `test@manfac.com.br` ✓
3. Attempt signup with `test@gmail.com` → error shown ✓
4. After valid signup → redirects to `/signup/verify` ✓
5. Go back to `/login` → greeting says "Bem-vindo de volta" ✓
6. After confirming email via Supabase and logging in → redirects to `/dashboard` ✓
7. Dashboard shows name and logout button ✓
8. Click "Sair" → back to `/login`, greeting now shows first name ✓

Stop server with Ctrl+C.

- [ ] **Step 4: Commit**

```powershell
git add "app/(dashboard)/"
git commit -m "feat: add protected dashboard placeholder with logout"
```

---

### Task 11: Deploy to Vercel

**Files:**
- No code changes — configuration in Vercel Dashboard

- [ ] **Step 1: Create GitHub repository**

Go to github.com → New repository → name: `manfac-portal` → private → Create.

```powershell
git remote add origin https://github.com/YOUR_USERNAME/manfac-portal.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Deploy to Vercel**

Go to [vercel.com/new](https://vercel.com/new) → Import Git Repository → select `manfac-portal`.

Framework Preset: **Next.js** (auto-detected).

- [ ] **Step 3: Configure environment variables in Vercel**

In Vercel project → Settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGci...your_anon_key
NEXT_PUBLIC_SITE_URL            = https://your-app.vercel.app
```

Click Deploy.

- [ ] **Step 4: Update Supabase redirect URLs for production**

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** add `https://your-app.vercel.app/**`

- [ ] **Step 5: Smoke test production**

1. Open `https://your-app.vercel.app` → redirects to `/login` ✓
2. Attempt login with wrong domain → error shown ✓
3. Full signup flow works with email confirmation ✓
4. Login sets name cookie, dashboard shows personalized greeting ✓
5. Logout clears session, login shows first-name greeting ✓

---

## Self-Review

**Spec coverage check:**
- ✅ Signup with domain validation (@manfac.com.br) — Task 7
- ✅ Email confirmation flow — Task 7 (Supabase + verify page)
- ✅ Login with credential validation — Task 8
- ✅ Email-not-confirmed error message — Task 8 actions.ts
- ✅ Session cookie (httpOnly, sameSite: lax) — Supabase handles this via @supabase/ssr
- ✅ First-name cookie (long duration) — Task 8 actions.ts
- ✅ Cookie-based personalized greeting — Task 8 page.tsx
- ✅ Pre-filled email when cookie exists — not implemented — **FIX BELOW**
- ✅ Middleware: no session → redirect to /login — Task 4
- ✅ Middleware: session with wrong domain → signout + redirect — Task 4
- ✅ Middleware: authenticated user on auth page → redirect to /dashboard — Task 4
- ✅ Logout: session removed, name cookie kept — Task 10
- ✅ Forgot password — Task 9
- ✅ Dashboard placeholder — Task 10
- ✅ Production deployment — Task 11

**Fix: pre-filled email field on login**

The spec says "Campo de e-mail pré-preenchido se houver cookie". The login page reads `manfac_user_name` (first name only). To pre-fill the email, I need to store it separately.

Update `app/(auth)/login/actions.ts` — in the cookie section after line `cookieStore.set('manfac_user_name', ...)`:
```typescript
cookieStore.set('manfac_user_email', email, {
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'lax',
  httpOnly: false,
})
```

Update `app/(auth)/login/page.tsx` — read the email cookie and pass to LoginForm:
```tsx
const userEmail = cookieStore.get('manfac_user_email')?.value

// ...in JSX:
<LoginForm urlError={error} defaultEmail={userEmail} />
```

Update `app/(auth)/login/LoginForm.tsx` — accept and use `defaultEmail`:
```tsx
interface LoginFormProps {
  urlError?: string
  defaultEmail?: string
}

export default function LoginForm({ urlError, defaultEmail }: LoginFormProps) {
  // ...in the email Input:
  <Input
    label="E-mail"
    name="email"
    type="email"
    placeholder="voce@manfac.com.br"
    defaultValue={defaultEmail}
    required
    autoComplete="email"
  />
```

This fix should be applied in Task 8 before committing, or as an addendum commit after Task 8.

**Placeholder scan:** No TBDs or TODOs in the plan. ✅

**Type consistency:**
- `signupAction(prevState, formData)` matches `useActionState(signupAction, {})` ✅
- `loginAction(prevState, formData)` matches `useActionState(loginAction, {})` ✅
- `forgotPasswordAction(prevState, formData)` matches `useActionState(forgotPasswordAction, {})` ✅
- `createClient()` is async in server.ts, awaited in all consumers ✅
- `getFirstName` used in actions.ts and imported from `@/lib/auth/domain` ✅
