# Divisão de trabalho — João e Duda

Decidida em 10/09/2026. **Escopo do Duda: apenas o Controle de Obras** (`app/obras/`) —
decisão do João, como teste da parceria. Se der certo, amplia.

> **A fonte detalhada é o pacote de onboarding**, em `docs/onboarding-duda/`:
> `00-CONTEXTO.md`, `01-REGRAS-DE-TRABALHO.md` e `02-FRENTES-DO-DUDA.md`.
> Este arquivo registra só a decisão e o porquê dela.
>
> Página para o Duda validar:
> https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54

## Critério, em ordem de peso

1. **Credencial** — o que só uma pessoa executa não é divisível.
2. **Canal com o cliente** — frente que depende de decisão do cliente fica com quem fala com ele.
3. **Sobreposição de arquivo** — duas frentes no mesmo arquivo não rodam em paralelo.

## João

| # | Frente | Por quê | Tempo | Tokens (est.) |
|---|---|---|---|---|
| 0 | Pôr a v0 no ar | Supabase, GitHub, EasyPanel e a planilha estão atrás de credencial dele. Bloqueia todo o resto | 25 min + espera | 150–300 k |
| 1a | Campos editáveis na Triagem e na ficha | Bloqueador do mecanismo central: `aprovacao` nula ⇒ obra nunca vira crítica. Depende da resposta do cliente | 4–6 h | 0,6–1,0 M |
| 1c | Sincronização do Field com o banco | A metade estratégica: decisão de negócio da "loja", webhook vs varredura, reconciliação, e o destino das 187 obras da planilha | 6–10 h | 0,9–1,8 M |
| — | Fechar as duas perguntas com o cliente | Único canal com o cliente | 15 min + espera | ~20 k |

**Frentes de código: 10–16 h · 1,5–2,8 M**

## Duda

| # | Frente | Por quê | Tempo | Tokens (est.) |
|---|---|---|---|---|
| F1 | Cliente da API do Field Control | Pasta nova (`_lib/field/`): zero sobreposição, zero credencial, testável só com mock. Começa já e alimenta a 1c | 6–10 h | 0,8–1,4 M |
| F2 | Smoke test contra o Supabase real | Nada deste módulo jamais tocou banco real; toda a cobertura é mock | 2–3 h | 0,2–0,3 M |
| F3 | Colunas mortas | `os_aprovada`, `marco_exec_fim`, `marco_relatorio`, `marco_os_aprov` só existem como tipo. Depende da 1a mergeada | 2–4 h | 0,3–0,5 M |

**Total: 10–17 h · 1,3–2,2 M**

## A única restrição de ordem

⚠️ **1a e F3 editam `app/obras/obra/[id]/_actions.ts`.** Por isso o Duda começa pela F1,
e pega a F3 só depois da 1a mergeada.

## Correção de uma estimativa anterior

A primeira versão desta divisão dava ao Duda uma frente de "foto diária" estimada em
4–6 h. **Esse trabalho já está construído** — `diario/_foto.tsx`, upload com redução,
`foto_path`, signed URL, bloco "Evolução em fotos" (`_ficha.tsx:627`) e o aviso de dia
sem foto (`_ficha.tsx:702`), mais bucket e policies na migration. A decisão L do
`ESTADO.md` ("tela na v1") foi lida como pendência quando era entrega da v0.

Também saiu do escopo do Duda a higiene das 7 suites de `manfac-site/`: não é Controle
de Obras.

## Notas sobre o equilíbrio

Em **horas** a divisão ficou parelha (10–16 h contra 10–17 h). Em **responsabilidade**,
não: com o João ficam o caminho crítico de ir ao ar, a decisão de negócio da integração,
o canal com o cliente e a frente que destrava o mecanismo central do produto. Com o Duda
ficam frentes de escopo fechado, verificáveis por teste, sem acesso a produção — que é o
formato certo para um primeiro trabalho em parceria.
