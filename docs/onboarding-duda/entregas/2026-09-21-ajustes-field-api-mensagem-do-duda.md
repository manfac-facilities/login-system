# Mensagem do Duda — 21/09/2026 — 7 ajustes da branch duda/field-api-client

Colada pelo João no chat, literal:

---

João, o Duda concluiu o bloco completo dos 7 ajustes da frente dele e publicou na branch duda/field-api-client.

Commits:
- 2ee819b — retorno da OS limpa ausência e falha ao ler situação interrompe a sincronização sem avançar a marca d’água.
- 42e40d4 — corrige o freio de ausências em massa, limita Retry-After, impede resposta duplicada de tarefa, torna o desfazer do diário atômico e restringe fotos.

Peço que sua IA faça agora uma revisão consolidada de origin/master...origin/duda/field-api-client, conferindo especialmente:

1. OS concluída ou cancelada que reaparece limpa field_ausente_desde e field_ausente_em.
2. Falha transitória ao consultar atividades do Field registra a execução como falha e mantém a marca d’água anterior.
3. Ausências em massa viram somente suspeitas na primeira passagem; alertas só aparecem após nova varredura e o intervalo mínimo.
4. Retry-After excessivo fica limitado a 30 segundos.
5. Uma segunda aba não sobrescreve tarefa já respondida.
6. Desfazer diário e apagar suas tarefas abertas ocorre na mesma transação.
7. Fotos aceitam apenas JPEG de até 5 MiB, com validação no navegador, na ação do servidor e configuração do bucket.

Verificações locais do Duda:
- 29 suítes de Obras passaram.
- 650 testes passaram; 1 está marcado como todo.
- TypeScript passou.
- Build passou.
- Lint passou sem erros; permaneceram 4 avisos preexistentes fora desta entrega.
- A árvore ficou limpa e a branch foi publicada.
- Não houve chamada real ao Field nem escrita em produção.
- Nenhum arquivo de app/obras/obra/[id]/ foi alterado.

Antes do deploy, há duas dependências:

1. Aplicar e testar em banco real sdd-sql-obras-desfazer-diario-atomico.sql.
2. Configurar o bucket privado obras-fotos para image/jpeg e máximo de 5242880 bytes, seguindo docs/obras/2026-09-21-limite-fotos.md.

A RPC precisa entrar antes do código, pois o novo código passa a chamá-la. Depois da revisão, ajuste o que for necessário, integre seguindo o fluxo de vocês e faça a validação operacional após o deploy.
