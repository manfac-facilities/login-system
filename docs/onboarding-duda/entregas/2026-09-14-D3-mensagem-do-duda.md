# D3 — mensagem de entrega do Duda

**Recebido em 14/09/2026**, colado no chat pelo João. Texto literal, sem edição.

> João, concluí a D3 e publiquei na branch duda/field-api-client.
>
> Commit: 972945b
>
> O que entrou:
>
> - Executor único compartilhado pelo botão e pelo agendamento. Não existe uma segunda
>   implementação da sincronização.
> - Tabela obras_sync_execucao para histórico, autoria, status, contagens e marca d'água.
> - A marca vigente vem da última execução com sucesso.
> - Incremental usa 10 minutos de margem e a nova marca é o maior updated_at recebido do
>   Field.
> - Falha no meio da gravação deixa a execução como falhou e não avança a marca.
> - Incremental inaugural pode ler tudo para formar a primeira marca, mas não usa essa
>   leitura como prova de ausência.
> - Trava no banco com índice único parcial para impedir botão e agendamento simultâneos.
> - Execuções órfãs expiram após duas horas.
> - Rota POST /api/obras/sincronizar, protegida por Authorization: Bearer
>   OBRAS_CRON_SECRET, com comparação em tempo constante.
> - A rota usa createAdminClient(), autoria nula e origem agendada.
> - A resposta da rota é 202 depois de registrar a execução; o resultado verdadeiro fica no
>   banco, independentemente do timeout do pg_net.
> - O botão continua sendo uma varredura completa, com usuário registrado como autor.
> - As últimas dez execuções aparecem em /obras/sincronizar.
> - Agendas escritas:
>   - incremental a cada 15 minutos;
>   - completa diariamente às 06:00 UTC, equivalente às 03:00 de Brasília.
>
> Migration não aplicada:
> sdd-sql-obras-sync-execucao.sql
>
> Ela cria tabela, índices, função de aquisição da trava e os dois jobs do pg_cron.
> Conforme combinado, não a executei. O arquivo pressupõe OBRAS_CRON_SECRET no Vault e a
> mesma variável no EasyPanel; essa configuração fica com você.
>
> Validação em Node 20:
>
> - 344/344 testes, 16 suítes;
> - TypeScript limpo;
> - lint sem erros, apenas os 3 avisos antigos do Sofia;
> - build concluído, incluindo a nova rota /api/obras/sincronizar.
>
> Não fiz chamadas reais ao Field, não acessei o banco de produção e não usei credenciais.
