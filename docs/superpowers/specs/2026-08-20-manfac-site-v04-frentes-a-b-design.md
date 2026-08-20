# Manfac Site v04 — Frentes A e B

**Data:** 2026-08-20
**Mockup aprovado:** https://claude.ai/code/artifact/32896699-1855-4735-8f59-f3ce404235b5 (aprovado pelo João em 20/08/2026)
**Escopo:** frente A (interação e polimento) + frente B (/contato com captura de lead)
**Fora de escopo:** frente C (blog) e frente D (tradução PT/EN/ES) — ver seção final

## Contexto

O site está no ar em `https://manfac.com.br` na v03. Dois stakeholders do cliente avaliam:
**Eduardo já aprovou**; **José está cobrando mais** — a v04 existe para destravar o José.

Referências fornecidas pelo João:
- `https://tols-energy.jdop2015.chatgpt.site/` — **estrutura** (protótipo gerado no ChatGPT; autoridade só sobre estrutura, não sobre execução)
- `https://sblok.com.br/` — **execução visual** (WordPress/Elementor Pro com Lenis, Lottie, Swiper, GTranslate)

### Dois achados que moldaram o desenho

1. **O reveal no scroll já existe.** `components/Reveal.tsx` (IntersectionObserver) + `.reveal` em `globals.css:49`, aplicado em **68 lugares, 18 componentes**, com `prefers-reduced-motion` respeitado. A diferença de sensação para o sblok é o **scroll interpolado (Lenis)**, não o reveal. Não reconstruir o que existe.
2. **O header já tem `backdrop-blur` — e ele não aparece.** `Header.tsx:23` usa `bg-[var(--background)]/95`: a 95% de opacidade não há o que borrar. O ajuste é de opacidade, não de efeito.

## Frente A — interação e polimento

Nenhum item aqui toca banco de dados. Tudo frontend.

### A1 · Header arredondado e flutuante

`Header.tsx` deixa de ser barra `sticky` de largura total com `border-b` e passa a pílula flutuante:

- `rounded-full`, contida em wrapper `fixed` com padding lateral
- Fundo `rgba(255,255,255,.70)` + `backdrop-filter: blur(10px)` — **70% foi a opacidade aprovada no mockup**
- Borda sutil + sombra leve; ao rolar (>20px) o wrapper contrai o padding (16px → 8px) e a sombra intensifica
- **Não** esconder ao descer — testado no mockup e mantido desligado

**Por que 70% e não os 30% do sblok:** o sblok é site escuro (`rgba(5,35,59,.30)`) e o Manfac é claro (`--background: #ffffff`). Copiar o número produziria header invisível e texto de menu (`--muted: #6e8894`) ilegível sobre imagens claras. O efeito foi traduzido, não copiado.

### A2 · Sublinhado animado no menu

Hoje o traço laranja só aparece na página ativa (`active &&`). Passa a existir também no hover:

- `::after` com `transform: scaleX(0)` → `scaleX(1)`, `transform-origin: left`
- `.32s cubic-bezier(.22, 1, .36, 1)` — mesma curva já usada no `.reveal`, para coerência
- Estado ativo continua com `scaleX(1)` permanente

Aplicar também ao menu mobile, mantendo o active-state que já existe lá.

### A3 · Scroll suave (Lenis)

**Dependência nova:** `lenis`. Provider client-side montado no `app/layout.tsx`.

- Desativar quando `prefers-reduced-motion: reduce`
- `globals.css:20` tem `scroll-behavior: smooth` (nativo, só afeta âncoras) — **remover** ao introduzir o Lenis, senão os dois competem em cliques de âncora
- Verificar que o dropdown de serviços e o menu mobile continuam operando com o scroll sequestrado

### A4 · Botão flutuante de WhatsApp

Componente novo `components/WhatsAppFloat.tsx`, montado no layout.

- `fixed` inferior direito, círculo de 54px, verde `#25d366`
- **Entra apenas após ~420px de scroll** (fade + slide + scale), fora disso `pointer-events: none`
- Expande no hover revelando "Falar no WhatsApp"
- **Nunca pulsa** — decisão explícita do João: fica fora da regra do pulso (A5) para não ser invasivo
- `aria-label` obrigatório; alvo mínimo de 44px atendido

### A5 · Pulso periódico nos CTAs

- Anel laranja via `::before` com `animation: pulse 5s infinite`, ativo por ~20% do ciclo
- Aplica a **todos os botões primários**, exceto os `ghost` e o flutuante do WhatsApp
- Suprimido em `prefers-reduced-motion`

### A6 · Ícone do WhatsApp e destino dos CTAs

Os CTAs deixam de apontar para `/contato` e vão direto para `wa.me`:

| Arquivo | Botão | Hoje | Passa a ser |
|---|---|---|---|
| `Header.tsx:105` | Falar com especialista | `/contato` | `wa.me` |
| `Hero.tsx:41` | Falar com especialista | `/contato` | `wa.me` |
| `ServicePage.tsx:43` | Solicitar proposta técnica | `/contato` | `wa.me` |

Todos ganham o ícone SVG do WhatsApp inline (sem biblioteca de ícones). Reaproveitar
`buildWhatsAppUrl`/`WHATSAPP_COMERCIAL` de `lib/whatsapp.ts`, com mensagem pré-preenchida
por origem (ex.: qual página de serviço).

**Ponto de atenção:** `/contato` deixa de receber tráfego dos CTAs principais. A página
continua existindo e sendo linkada pelo menu e pelo rodapé — é intencional, mas significa
que o formulário da frente B passa a ser o caminho secundário, e o WhatsApp o primário.

### A7 · Rodapé expandido

`Footer.tsx` hoje tem 12 linhas (logo + copyright). Passa a 4 colunas:

1. **Marca** — logo, tagline, botão "Falar agora"
2. **Serviços** — hub + as 4 subpáginas (`obras-e-reformas`, `novas-construcoes`, `manutencao-predial`, `hvac`)
3. **Institucional** — Início, Quem somos, Resultados (Blog entra na frente C)
4. **Contato** — WhatsApp, e-mail, endereço

Ganho colateral: link interno estruturado para as subpáginas, que rende na auditoria de SEO da fase 2.

## Frente B — /contato com captura de lead

### Guard-rail explícito

**Os 3 boxes de "qual é sua demanda" não mudam.** O João foi enfático sobre isso mais de
uma vez. Muda apenas: mecânica de envio, bloco de contato ao lado, mapa embaixo.

### B1 · O problema atual

`ContactForm.tsx:28` é 100% client-side: `preventDefault()` → monta URL → `window.open()`.
Não há `fetch`, Server Action, rota de API nem persistência. **Nenhum lead é capturado.**
Quem não conclui no WhatsApp (popup bloqueado, app não instalado, desistência) não deixa
rastro algum.

### B2 · Modelo de duas etapas

Espelha o tols-energy, cuja lógica o João validou:

| Etapa | Campos | Comportamento |
|---|---|---|
| **1 — Seus dados** | nome, telefone/WhatsApp, e-mail, consentimento | **Obrigatória. Grava o lead e retorna o id.** |
| **2 — Sua necessidade** | empresa, cargo, localidade, unidades, resumo | **Opcional. Faz update no mesmo id.** |

**A etapa 2 ser opcional é o que faz o modelo funcionar:** o lead está garantido ao fim da
etapa 1; o contexto é bônus. É exatamente por isso que a indexação é necessária — a etapa 2
pode nunca vir.

O `path` escolhido nos 3 boxes é gravado junto, o que permite medir qual demanda converte mais.

### B3 · Infraestrutura — o custo escondido

**O `manfac-site` não tem Supabase.** Não há `@supabase/supabase-js` no `package.json` nem
uma única referência no código. Portanto a frente B exige:

1. **Dependência nova:** `@supabase/supabase-js` no `manfac-site`
2. **Tabela nova** no projeto `iyytcavcgukfjnjjrerx` (confirmar o ref antes de escrever), via
   arquivo `sdd-sql-*.sql` aplicado à mão — o projeto não tem CLI de migration
3. **Server Action** (`app/contato/_actions.ts`) usando **service role**, nunca o client do
   navegador. Escrita anônima direta pelo browser abriria a tabela para spam.
4. **Segredo novo no EasyPanel**, no app `manfac-site` — que hoje não tem nenhuma variável
   de ambiente configurada

> ⚠️ **Armadilha conhecida do EasyPanel:** o campo *Environment* é texto livre e cada
> variável precisa ser `NOME=valor` **na mesma linha**. Chave longa colada com quebra de
> linha invalida silenciosamente e o container sobe sem variável nenhuma. Foi exatamente o
> que aconteceu com a `SUPABASE_SERVICE_ROLE_KEY` do hub em 09/08. Confirmar pelo log do
> container, nunca pela tela do painel.

### B4 · Esquema da tabela

```
site_leads
  id             uuid primary key default gen_random_uuid()
  criado_em      timestamptz not null default now()
  atualizado_em  timestamptz
  path           text not null          -- qual dos 3 boxes
  nome           text not null
  email          text not null
  telefone       text not null
  consentimento  boolean not null       -- LGPD
  consentido_em  timestamptz            -- carimbo do aceite
  empresa        text                   -- etapa 2 em diante, tudo opcional
  cargo          text
  localidade     text
  unidades       text
  resumo         text
  etapa2_em      timestamptz            -- null = etapa 2 nunca veio
```

**RLS:** nenhuma policy de leitura ou escrita para `anon`/`authenticated`. Acesso só pela
service role, a partir da Server Action. Coerente com o padrão já usado em
`hub_user_roles`/`hub_system_access`.

### B5 · LGPD

A partir do momento em que nome, e-mail e telefone são gravados, a Manfac vira controladora
de dados pessoais. Hoje isso não se aplica porque nada é armazenado.

- Checkbox de consentimento na etapa 1, **não pré-marcado**
- `consentimento` e `consentido_em` gravados na mesma linha do lead
- Texto do consentimento declarando a finalidade

**Decisão pendente do João** (ver seção final). O custo é baixo se feito agora e alto se
feito depois, com base já preenchida.

### B6 · UX da página

- **Bloco de contato ao lado** do formulário: WhatsApp, e-mail, e (a confirmar) Instagram e fixo
- **Mapa embaixo**, largura total, com endereço escrito e link "Abrir no Google Maps"
- O WhatsApp segue disponível como caminho direto, para quem não quer preencher nada

### B7 · Relação com o WhatsApp

Após gravar a etapa 1, o comportamento atual (abrir o `wa.me` com a mensagem montada)
**é preservado**. A mudança é de ordem: **grava primeiro, redireciona depois**. Se o
WhatsApp falhar, o lead já existe.

## Testes

Cobertura mínima, seguindo `__tests__/` ao lado do código:

- `lib/whatsapp.ts` — os 5 testes atuais seguem válidos; somar caso da mensagem por origem
- `WhatsAppFloat` — não renderiza visível abaixo do limiar; visível acima
- `Footer` — as 4 subpáginas de serviço estão linkadas
- Server Action da etapa 1 — grava e devolve id; rejeita sem consentimento
- Server Action da etapa 2 — atualiza o id existente; nunca cria linha nova
- `Header` — sublinhado no hover não quebra o active-state existente

**Nota sobre o ambiente:** o `vitest` do `manfac-site` falha de forma intermitente ao subir
workers no Windows (`Timeout waiting for worker to respond`) quando roda os 4 arquivos em
lote. Rodando arquivo a arquivo, ou com `--pool=threads --no-file-parallelism`, passa
15/15. Não é teste quebrado — é flake de pool. Não interpretar como regressão.

## Decisões pendentes do João

Bloqueiam apenas os itens indicados; o resto pode ser implementado sem elas.

| Pendência | Bloqueia |
|---|---|
| Endereço da empresa | A7 (rodapé), B6 (mapa) |
| Tagline | A7 |
| Telefone fixo — existe? | A7, B6 |
| Instagram — entra no bloco? | B6 |
| Checkbox de LGPD entra? | B5 |

## Fora de escopo

- **Frente C (blog)** — `/blog` + `/blog/[slug]`, spec própria
- **Frente D (tradução PT/EN/ES)** — spec própria, **depois da auditoria de copy/SEO**;
  traduzir antes garante retrabalho, já que a auditoria vai alterar texto
- **Analytics/GA4** — segue adiado. A contagem de linhas em `site_leads` já responde a
  pergunta comercial principal sem custo adicional
- **Plataforma de atendimento com IA no WhatsApp** — adiado por decisão do João até o site
  estar aprovado pelos dois stakeholders; ordem acordada é capturar → medir um mês →
  automatizar
