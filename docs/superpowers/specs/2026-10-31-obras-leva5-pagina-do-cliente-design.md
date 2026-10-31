# OBRAS — Leva 5: página do cliente

**Data:** 31/10/2026 · **Fontes:** spec base `2026-10-29-obras-modalidade-obra-design.md` (decisão 7: "Cliente tem acesso à página da obra só se cadastrado: digita o e-mail e entra sem senha (código/link no e-mail)"; Fase 3: "entrada separada do login Manfac (hoje restrito a `@manfac.com.br`) — e-mail cadastrado + código de uso único no e-mail; cliente vê só as obras em que está cadastrado; abas Visão geral, Cronograma, Impedimentos ("Aguardando vocês"), Diários, Relatórios. **Território de autenticação/RLS do AGENTS.md — tratar bordas.** Botão "Ver a obra completa" passa a ir nos e-mails."); mapa A15 (Documentos em pastas + galeria por data e etapa) e A16 (Mensagens da obra no portal). José, 31/10: "pode continuar com os próximos passos" (sem pausa; ele valida a Leva 4 em paralelo). **Base:** master `f806f6d` (Levas 1–4 no ar).

## 1. Intenção
O cliente para de perguntar "como está a obra": entra com o e-mail cadastrado e um código, vê só as obras dele, com os mesmos dados (versão cliente) que já recebe por e-mail, mais documentos, galeria e um canal de mensagens com a Manfac que substitui o WhatsApp para decisões.

## 2. Anti-objetivos
- Cliente nunca vê R$, item oculto, área interna da Manfac, `numero` interno, nem obra em que não está cadastrado.
- O portal não usa o login Manfac nem cria usuário no Supabase Auth do hub; não dá acesso a nenhum outro sistema.
- Nada de enumeração de e-mails ("se o e-mail estiver cadastrado, enviamos um código").

## 3. O que entra

### 3.1 Acesso (chamadas minhas — território de autenticação, bordas tratadas)
- **Cadastro:** em Configurações da obra (admin), lista "Acesso à página do cliente": e-mail, nome, ativo. Atalho "trazer destinatários do lado cliente". E-mail `@manfac.com.br` recusado (interno usa o hub).
- **Entrada:** `/portal-obra` (fora do `matcher` do middleware, guarda própria). Digita o e-mail → se cadastrado e ativo em alguma obra, recebe **código de 6 dígitos** por e-mail (remetente atual da Locaweb), válido **10 min**, uso único, **5 tentativas** por código, no máximo **5 códigos por hora** por e-mail e **20 por hora por IP**. Resposta sempre igual. Código guardado só como hash (HMAC-SHA256 com segredo do servidor `PORTAL_OBRA_SEGREDO`).
- **Sessão:** token aleatório de 32 bytes em cookie `httpOnly`, `secure`, `sameSite=lax`, path `/portal-obra`, validade **7 dias** (renovada no uso, teto 30 dias); no banco só o hash. "Sair" revoga. Desativar o acesso de um e-mail derruba as sessões dele no próximo acesso (a sessão vale só enquanto houver acesso ativo).
- **Leitura:** pelo servidor com o cliente admin, sempre filtrando pelas obras em que o e-mail da sessão tem acesso ativo; id de obra da URL só é aceito se estiver nessa lista (senão 404). Tabelas de acesso/código/sessão sem nenhuma policy para `anon`/`authenticated`.

### 3.2 Páginas do portal (versão cliente de tudo)
- **Minhas obras** (se mais de uma) → obra com abas:
  - **Visão geral:** sinal, avanço base × previsto × realizado, curva S, previsão de entrega com quebra por responsável, "Aguardando vocês" (impedimentos do cliente e restrições do cliente abertas), últimos highlights.
  - **Cronograma:** por etapa (barras base × previsto × realizado), código exibido.
  - **Aguardando vocês:** lista completa com prazo e desde quando.
  - **Diários e relatórios:** os enviados ao cliente (diário, semanal, mensal, fase, entrega, atas enviadas) com **Abrir PDF** (o mesmo PDF cliente; congelado quando houver).
  - **Galeria:** fotos de diários validados/enviados, por data e por etapa (etapa pela atividade da foto quando existir; senão "Geral").
  - **Documentos:** pastas fixas **Projetos, Laudos, ART, Layout, Termos, Outros**; a Manfac sobe (em Configurações → Documentos ou na própria aba do hub), o cliente vê e baixa. *Chamada minha: cliente não sobe arquivo nesta leva.*
  - **Mensagens:** conversa por obra; o cliente escreve e responde; a Manfac responde pela Comunicação do hub (a mensagem entra na linha do tempo). Nova mensagem do cliente → e-mail ao engenheiro da obra e aos destinatários internos com tipo imediato. *Chamada minha: texto, sem anexo.*
- Tema Manfac claro, celular primeiro.
- **"Ver a obra completa"**: link para `/portal-obra` em todos os e-mails do lado cliente (diário, semanal, mensal, fase, entrega, ata, imediata).

## 4. Fora
Assinatura do cliente no RDO, upload pelo cliente, aprovações formais, mapa (Leva 6), financeiro.

## 5. Dados (`sdd-sql-obras-leva5.sql`)
- `obras_portal_acesso` (obra_id, email lower check sem `@manfac.com.br`, nome, ativo, criado_por/em forçados; unique(obra_id, email)); RLS: select/insert/update/delete só admin obras (`obras_is_admin()`).
- `obras_portal_codigo` (email, codigo_hash, expira_em, tentativas, usado_em, criado_em, ip) e `obras_portal_sessao` (token_hash unique, email, criado_em, expira_em, ultimo_uso, revogada_em): RLS ligada **sem policy** (só service role).
- `obras_documento` (obra_id, pasta check, nome, path no bucket `obras-docs` = `<obra_id>/<uuid>-<nome-saneado>`, tamanho, tipo, criado_por/em forçados); RLS hub: select obras; insert/delete engenheiro/admin. Bucket privado `obras-docs` com policies de escrita só engenheiro/admin no prefixo da obra; leitura no portal por URL assinada curta gerada no servidor.
- `obras_mensagem` (obra_id, autor_tipo `cliente|manfac`, autor_email, texto ≤ 4000, criado_em forçado); RLS hub: select obras; insert com autor_tipo `manfac` e autor = JWT; cliente grava pelo servidor (service role) com autor_tipo `cliente` e o e-mail da sessão. Sem update/delete (registro).
- `obras_envio.tipo` aceita `portal_codigo`? **Não** — código não é comunicação da obra; não registrar em obras_envio.

## 6. Restrições
AGENTS.md (autenticação, RLS e acesso são exceções: tratar bordas), rules obras/sql/acesso-e-admin. SQL só em arquivo; nenhum agente executa SQL. Segredo novo `PORTAL_OBRA_SEGREDO` só no EasyPanel (nunca em arquivo versionado). Sem dependência nova.
