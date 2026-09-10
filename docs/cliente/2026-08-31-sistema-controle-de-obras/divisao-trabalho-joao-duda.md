# Divisão de trabalho — João e Duda

Escrita em 10/09/2026, antes de aplicar `sdd-sql-obras-v0.sql` e antes do deploy.

**Critério da divisão.** Não é tamanho de tarefa. São três coisas, nesta ordem:

1. **Credencial** — o que só uma pessoa consegue executar não é divisível.
2. **Canal com o cliente** — frente que depende de decisão do cliente fica com quem
   fala com ele.
3. **Sobreposição de arquivo** — duas frentes que editam o mesmo arquivo não rodam em
   paralelo sem merge doloroso. Este critério gerou a única restrição de ordem abaixo.

**Sobre a coluna de tokens.** São **estimativas**, não medições — não há telemetria por
tarefa. A calibragem é o tamanho real do módulo, medido em 10/09: 6.638 linhas de código
e 2.508 de teste, em 30 arquivos sob `app/obras/`. Inclui o custo dos subagentes e da
revisão independente, não só o da escrita.

---

## João — o pesado e o estratégico

| # | Frente | Por que é dele | Tempo | Tokens (est.) |
|---|---|---|---|---|
| **0** | **Pôr a v0 no ar** — migration, push, deploy, importar planilha, liberar acessos, amarrar e-mails | **Intransferível hoje.** Supabase (a conta dona é `jose.guilherme@manfac.com.br`), GitHub (a conta desta máquina, `Mainsis`, tem `push: false`), EasyPanel (o botão Deploy) e a planilha DPSP estão todos atrás de credencial dele. Nenhum dos seis passos é delegável enquanto isso não mudar | **25 min** de trabalho + ~30 min de espera de build | 150–300 k |
| **1c** | **Integração com a API do Field Control** | A **maior frente** e a que muda o produto: hoje toda obra entra por planilha. A chave da API é dele. E sobra uma decisão de negócio em aberto — se "localização da loja" é o endereço físico (`address`, sem custo extra) ou o nome da loja cadastrada (`location.name`, uma chamada a mais por OS, contra rate limit de 1 req/s) — que é conversa com o cliente | **12–18 h** | 1,5–3,0 M |
| **1a** | **Campos editáveis na Triagem e na ficha** | É o **bloqueador do mecanismo central do produto**: com o Field entregando só 3 dos 8 campos e a Triagem sumindo quando a obra sai de `definir`, `aprovacao` fica nula para sempre — e obra sem data de aprovação nunca vira crítica, que é o problema que originou o projeto. Depende da resposta do cliente à pergunta 01 | **4–6 h** (mockup 1h + código/testes 3h + review) | 0,6–1,0 M |
| — | **Fechar as duas perguntas com o cliente** | Único canal com o cliente. Página pronta e publicada: `pergunta-04-para-o-cliente.html` | **15 min** + espera da resposta | ~20 k |

**Total das frentes de código do João: 16–24 h · 2,1–4,0 M tokens**, mais o bloco 0.

---

## Duda — autocontido, sem credencial, sem cliente no meio

| # | Frente | Por que é dele | Tempo | Tokens (est.) |
|---|---|---|---|---|
| **1d** | **Foto diária na linha do tempo** (decisão L) | Requisito **já fechado com o cliente** e sem ambiguidade — não precisa de nova rodada de decisão. Vive em `app/obras/diario/`, **zero sobreposição** com o que o João toca. É a frente que melhor roda em paralelo | **4–6 h** | 0,5–0,8 M |
| **1b** | **Colunas mortas** — fazer `os_aprovada`, `marco_exec_fim`, `marco_relatorio` e `marco_os_aprov` serem escritas; corrigir o texto da ficha que promete dedução do Field | Escopo fechado e verificado: hoje essas quatro só existem como campo de tipo em `_lib/tipos.ts:222,238-240`, sem nenhuma escrita no código todo. Testável com mock, sem banco real, sem cliente | **2–4 h** | 0,3–0,5 M |
| — | **Higiene** — as 7 suites de `manfac-site/` que não carregam | Isolado do hub, risco zero, e é um bom primeiro contato com o repositório antes de tocar código de produção | **1–2 h** | 0,1–0,2 M |

**Total do Duda: 7–12 h · 0,9–1,5 M tokens**

---

## A única restrição de ordem

⚠️ **1a e 1b editam o mesmo arquivo** — `app/obras/obra/[id]/_actions.ts`. A Triagem grava
lá, e os marcos precisam ser gravados na troca de etapa, que também mora lá.

**Sequência que evita o conflito:**

```
Duda:  1d (foto diária) ─────────────►  1b (colunas mortas)
João:  1a (campos editáveis) ──► merge ──┘
       1c (Field Control) ─────────────────────────────►  (pasta própria, paralelo a tudo)
```

O Duda começa por **1d**, não por 1b. Quando a 1a estiver mergeada, ele pega a 1b.
A 1c é código novo em pasta própria e roda em paralelo com qualquer coisa.

---

## Totais

| | Tempo | Tokens (est.) |
|---|---|---|
| João (frentes de código) | 16–24 h | 2,1–4,0 M |
| João (bloco 0, hoje) | 25 min + espera | 0,15–0,3 M |
| Duda | 7–12 h | 0,9–1,5 M |
| **Projeto até a v1 completa** | **23–36 h** | **3,2–5,8 M** |

Fora deste escopo: o **agente de IA cobrador por WhatsApp** (camada 3 na ordem definida
pelo cliente na reunião de 31/08). Ele está travado pelo cadastro de telefones das
equipes e prestadores, que é trabalho de operação do João, e é projeto próprio — não
entra nesta conta.
