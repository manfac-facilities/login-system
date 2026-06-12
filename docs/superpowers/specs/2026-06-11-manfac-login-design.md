# Sistema de Login — Manfac Facilities

**Data:** 2026-06-11  
**Status:** Aprovado

---

## Visão Geral

Sistema de autenticação web para o painel de operações da Manfac Facilities. O acesso é restrito a usuários com e-mail `@manfac.com.br`. Após autenticação, o usuário acessa o dashboard operacional.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Autenticação | Supabase Auth |
| Banco de dados | Supabase (PostgreSQL) |
| Estilização | Tailwind CSS v4 |
| Linguagem | TypeScript |

---

## Identidade Visual

- **Tema:** Dark Navy Premium
- **Cor primária:** Azul Navy `#0d2050` / fundo `#0a1628`
- **Cor de destaque:** Laranja Manfac `#f05a28`
- **Texto:** Branco `#ffffff` e cinza `#94a3b8`
- **Fonte:** Inter (web) — compatível com Liter Grotesque da marca
- **Logo:** `LogoPrincipal1.png` (versão colorida) em fundos escuros

---

## Estrutura de Rotas

```
/app
├── (auth)
│   ├── login/page.tsx          → tela de login
│   └── signup/page.tsx         → tela de cadastro
├── (dashboard)
│   └── page.tsx                → dashboard protegido (placeholder)
└── middleware.ts                → proteção de rotas + validação de sessão
```

---

## Fluxo de Autenticação

### Cadastro
1. Usuário preenche: nome completo, e-mail, senha, confirmação de senha
2. Sistema valida que o e-mail termina em `@manfac.com.br` — erro imediato se não for
3. Supabase cria a conta com senha em hash (bcrypt)
4. Supabase envia e-mail de confirmação automático para o endereço cadastrado
5. Usuário clica no link do e-mail → conta ativada
6. Usuário é redirecionado para a tela de login

### Login
1. Usuário preenche e-mail e senha
2. Supabase valida as credenciais
3. Se a conta não foi confirmada por e-mail, exibe aviso e bloqueia acesso
4. Sessão criada → cookie seguro (`httpOnly`, `sameSite: lax`) salvo no browser
5. Cookie persistente separado salva o primeiro nome do usuário (longa duração)
6. Usuário redirecionado para o dashboard

### Proteção de Rotas (Middleware)
- Toda rota dentro de `(dashboard)` passa pelo middleware
- Middleware verifica sessão Supabase via cookie
- Sem sessão válida → redireciona para `/login`
- Sessão válida mas e-mail não é `@manfac.com.br` → sessão invalidada, redireciona para `/login` com erro "acesso não autorizado"

### Logout
- Supabase invalida a sessão
- Cookie de sessão removido
- Cookie de nome mantido (para personalizar o próximo login)
- Redirecionamento para `/login`

### Recuperação de Senha
- Link "Esqueceu a senha?" na tela de login
- Supabase envia e-mail com link de redefinição
- Fluxo gerenciado pelo Supabase nativamente

---

## Personalização da Tela de Login

Se houver cookie com o primeiro nome do usuário:
- Saudação personalizada: *"Olá, [Nome]! Digite sua senha para continuar."*
- Campo de e-mail pré-preenchido

Se não houver cookie (primeiro acesso ou novo dispositivo):
- Saudação genérica: *"Bem-vindo de volta"*
- Campos em branco

Se a sessão ainda for válida:
- Middleware redireciona direto para o dashboard — usuário não vê a tela de login

---

## Restrição de Domínio

A validação `@manfac.com.br` é aplicada em duas camadas:

1. **Frontend (signup):** verificação antes de chamar o Supabase — erro exibido na tela
2. **Middleware (servidor):** verifica o domínio do e-mail da sessão autenticada — sessão negada se inválido

---

## Telas

### `/login`
- Logo Manfac (horizontal, versão colorida)
- Título personalizado ou genérico (conforme cookie)
- Campo: e-mail (pré-preenchido se houver cookie)
- Campo: senha
- Link: "Esqueceu a senha?"
- Botão: "Entrar no sistema →"
- Rodapé: versão do sistema + indicador de status online

### `/signup`
- Logo Manfac
- Campo: nome completo
- Campo: e-mail corporativo
- Campo: senha
- Campo: confirmar senha
- Botão: "Criar conta →"
- Link: "← Já tenho conta" (volta para login)

### Tela intermediária pós-cadastro
- Mensagem: "Verifique seu e-mail"
- Instrução para clicar no link enviado para o e-mail cadastrado

---

## Fora de Escopo (esta entrega)

- Gestão de usuários (admin criar/remover contas)
- Roles e permissões por nível de acesso
- Login social (Google, Microsoft)
- Conteúdo do dashboard operacional
