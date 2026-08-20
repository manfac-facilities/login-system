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
- **Visível 100% do tempo, desde o topo da página** — sem limiar de scroll. Correção do João
  em 20/08: esconder o botão até rolar perde quem entra e decide na hora.
- Entrada suave de ~0.5s no carregamento
- Expande no hover revelando "Falar no WhatsApp"
- **Halo verde pulsante**, mesma mecânica do A5 (spread voltando a zero no repouso, blur
  muito maior que o deslocamento, animação parando no hover), no verde claro
  `rgb(94,246,150)` — o verde oficial `#25d366` é escuro demais e some contra o fundo branco:

```css
.wa { box-shadow: 0 0 18px 1px rgba(94,246,150,.49),
                  0 0 36px 4px rgba(94,246,150,.24),
                  0 5px 14px rgba(0,0,0,.16); }
@keyframes wa-breathe {
  0%, 100% { box-shadow: 0 0 13px  0px rgba(94,246,150,.52),
                         0 0 22px  0px rgba(94,246,150,.21),
                         0 5px 14px rgba(0,0,0,.16); }
  45%      { box-shadow: 0 0 29px 14px rgba(140,255,185,.60),
                         0 0 67px 28px rgba(94,246,150,.20),
                         0 5px 14px rgba(0,0,0,.16); }
}
.wa:hover { box-shadow: 0 0 24px 4px rgba(140,255,190,.66),
                        0 0 49px 11px rgba(94,246,150,.32),
                        0 5px 14px rgba(0,0,0,.16); }
```

> **Nota histórica:** a ideia original era o botão não animar de jeito nenhum. O João
> reviu em 20/08 pedindo "dar vida ao botão". O que ele vetou foi o **anel expandindo**,
> não o brilho — o halo pulsante foi aprovado. Ver A5.
- `aria-label` obrigatório; alvo mínimo de 44px atendido

> **A distinção que vale registrar:** a ressalva original do João ("não ser animado sem
> passar o scroll em cima") era sobre a **animação** ser invasiva, não sobre a
> **visibilidade**. São coisas separadas — o botão fica sempre visível **e** sempre quieto.

### A5 · Halo pulsante nos CTAs

**Substitui a ideia original de anel expandindo, reprovada pelo João em 20/08.** O anel era
um contorno se afastando do botão; o halo é luz saindo dele. Mesma intenção, leitura
completamente diferente.

A mecânica é a mesma do botão do WhatsApp (A4), na laranja da marca — os dois elementos de
conversão do site pulsam igual, um em verde e outro em laranja:

```css
.btn:not(.ghost) { animation: btn-pump 2.6s ease-in-out .6s infinite; }
@keyframes btn-pump {
  0%, 100% { box-shadow: 0 0 11px  0px rgba(255,150,90,.49),
                         0 0 20px  0px rgba(255,150,90,.20),
                         0 4px 12px rgba(0,0,0,.12); }
  45%      { box-shadow: 0 0 27px 12px rgba(255,175,120,.56),
                         0 0 60px 24px rgba(248,94,11,.15),
                         0 4px 12px rgba(0,0,0,.12); }
}
.btn:not(.ghost):hover { box-shadow: 0 0 22px 4px rgba(255,180,130,.66),
                                     0 0 45px 10px rgba(248,94,11,.25),
                                     0 4px 12px rgba(0,0,0,.12); }
.btn:not(.ghost):hover { animation: none; }
```

**Três detalhes que fazem o efeito funcionar e são fáceis de perder:**

1. **O spread volta a zero no repouso.** É o contraste entre encolher até colar no botão e
   disparar para fora que o olho lê como pump. Halo que nunca some vira só "mais brilho".
2. **Blur muito maior que o deslocamento**, e deslocamento vertical zero. É o que transforma
   sombra em brilho. Princípio observado no sblok e traduzido para as cores da Manfac.
3. **A animação para no hover.** Sem `animation: none`, o keyframe sobrescreve o `box-shadow`
   do hover e o botão parece não responder ao mouse.

Aplica a todos os botões primários. **Os `ghost` ficam de fora** — se todos brilhassem,
nenhum seria prioridade. Suprimido em `prefers-reduced-motion`.

**Intensidade:** os valores acima já são a versão calibrada a 70% da primeira tentativa,
que o João achou forte demais. Blur, spread e opacidade foram reduzidos **juntos** — mexer
só na opacidade manteria o halo do mesmo tamanho, só mais apagado.

### A6 · Ícone do WhatsApp e destino dos CTAs

Os CTAs deixam de apontar para `/contato` e vão direto para `wa.me`:

| Arquivo | Copy hoje | Copy nova | Destino hoje | Destino novo |
|---|---|---|---|---|
| `Header.tsx:105` | Falar com especialista | **Solicitar atendimento** | `/contato` | `wa.me` |
| `Hero.tsx:41` | Falar com especialista | **Solicitar atendimento** | `/contato` | `wa.me` |
| `ServicePage.tsx:43` | Solicitar proposta técnica | *(ver abaixo)* | `/contato` | `wa.me` |

**Copy "Solicitar atendimento"** substitui "Falar com especialista" — decisão do João em 20/08.

**Pendência de copy no `ServicePage`:** "Solicitar proposta técnica" não é "Falar com
especialista", então não entrou na troca. Agora convive com "Solicitar atendimento" em
páginas vizinhas. Três saídas: padronizar tudo, manter a distinção, ou deixar para a
auditoria de copy da fase 2. **Recomendação: manter a distinção** — nas páginas de serviço,
"proposta técnica" qualifica melhor o lead do que um convite genérico. Decisão do João.

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

**Nota sobre o ambiente — resolvido em 20/08 (commit `ef6ebee`).** O `vitest` falhava de
forma intermitente ao subir workers no Windows (`Timeout waiting for worker to respond`),
às vezes levando 99s para nem rodar. A causa era o ambiente executar **Node 24** enquanto o
`.nvmrc` pede **Node 20** — o pool de workers do Vitest 4 estoura nessa combinação.
Corrigido em `vitest.config.mts` com thread única, o que fez a suíte voltar a rodar inteira
em ~30s. **`npm test` funciona puro; não passar flags de pool.**

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
